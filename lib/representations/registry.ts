import { preflightSpatialView,spatialAssets } from '../spatial/model';
import { validateComposedScene } from '../../shared/composed-scene';
import { capabilityDescriptorSchema, capabilityNeedSchema, capabilityEnvironmentSchema, viewCapability, type CapabilityDescriptor, type CapabilityNeed, type CapabilityGap, type CapabilityEnvironment } from '../../shared/representation-capabilities';
import { representationViewSchema, type RepresentationPlan } from '../../shared/representations';
import { validateScientificQuantity } from '../../shared/scientific-quantities';
import { hasCheckedAssetIntegrity } from '../assets/local';
import type { ScientificAsset } from '../../shared/scientific-assets';
import type { WidgetEnvelope } from '../../shared/widgets';
import type { WidgetResult } from '../widgets/compute';
import type { ExecutedRepresentationView, RepresentationView } from './lifecycle';

export type AdapterContext={plan:RepresentationPlan;assets:readonly ScientificAsset[];signal?:AbortSignal;compute?:(widget:WidgetEnvelope,signal?:AbortSignal)=>Promise<WidgetResult>};
export type RepresentationAdapter={descriptor:CapabilityDescriptor;execute:(view:RepresentationView,context:AdapterContext)=>Promise<ExecutedRepresentationView>};
export function defaultCapabilityEnvironment():CapabilityEnvironment{
 const browser=typeof window!=='undefined',facilities:CapabilityEnvironment['facilities'][number][]=[];
 if(!browser||typeof Worker!=='undefined'&&typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')facilities.push('trusted-computation');
 if(typeof crypto!=='undefined'&&crypto.subtle)facilities.push('asset-integrity');
 const offline=browser&&typeof navigator!=='undefined'&&!navigator.onLine;if(!offline&&typeof fetch==='function')facilities.push('network');
 return {facilities,offline};
}
const key=(reference:{id:string;version:string})=>`${reference.id}@${reference.version}`;
function freeze(value:unknown){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}}
function environmentGaps(descriptor:CapabilityDescriptor,environment:CapabilityEnvironment,bytes=0):CapabilityGap[]{
 const gaps:CapabilityGap[]=[];
 for(const facility of descriptor.facilities)if(!environment.facilities.includes(facility)||facility==='network'&&environment.offline)gaps.push({kind:'environment',requirement:facility,reason:`${descriptor.label} needs ${facility}${environment.offline?' while offline':''}.`,nextAction:'Use an available local representation or explicitly enable the required environment through its approved workflow.'});
 if(bytes>descriptor.limits.maxInputBytes||bytes>(environment.maxInputBytes??2*1024*1024))gaps.push({kind:'resource',requirement:'input-bytes',reason:`The input exceeds ${descriptor.label} or the environment budget.`,nextAction:'Choose a smaller input or an approved adapter with a sufficient budget.'});
 return gaps;
}

/** Only trusted application code registers executable adapters. A JSON manifest cannot install one. */
export function createCapabilityRegistry(input:readonly RepresentationAdapter[]){
 const adapters=new Map<string,RepresentationAdapter>();
 for(const candidate of input){
   if(typeof candidate.execute!=='function')throw Error('A capability needs a trusted executable adapter, not metadata alone.');
   const descriptor=capabilityDescriptorSchema.parse(candidate.descriptor);
   if((descriptor.optionalFacilities??[]).some(facility=>descriptor.facilities.includes(facility)))throw Error('Optional and required facilities must be distinct.');
   if(descriptor.permissions.network!==(descriptor.facilities.includes('network')||!!descriptor.optionalFacilities?.includes('network')))throw Error('Network permissions and required facilities must agree.');
   if(adapters.has(key(descriptor)))throw Error('Duplicate capability identity/version.');
   freeze(descriptor);adapters.set(key(descriptor),Object.freeze({descriptor,execute:candidate.execute}));
 }
 return Object.freeze({
   list:()=>[...adapters.values()].map(adapter=>structuredClone(adapter.descriptor)),
   gaps(plan:RepresentationPlan,environment:CapabilityEnvironment=defaultCapabilityEnvironment(),assets:readonly ScientificAsset[]=[]):CapabilityGap[]{
     environment=capabilityEnvironmentSchema.parse(environment);
     const gaps:CapabilityGap[]=[];
     for(const ref of plan.execution.capabilities){const adapter=adapters.get(key(ref));if(!adapter)gaps.push({kind:'capability',requirement:key(ref),reason:'This exact capability version is not installed.',nextAction:'Retain the original and choose an installed adapter; no nearest-version or unrelated algorithm was substituted.'});else gaps.push(...environmentGaps(adapter.descriptor,environment));}
     for(const view of plan.views){const ref=viewCapability(view),adapter=adapters.get(key(ref));if(adapter&&!adapter.descriptor.viewKinds.includes(view.kind))gaps.push({kind:'capability',requirement:key(ref),reason:'The adapter does not support this view kind.',nextAction:'Choose a matching approved view adapter.'});if(adapter){const payload=view.kind==='spatial-view'?assets.filter(asset=>spatialAssets(view.spatial).includes(asset.id)):view.kind==='statistical-chart'?assets.filter(asset=>view.chart.series.some(series=>series.assetId===asset.id)):view.kind==='asset'?assets.find(asset=>asset.id===view.assetId):view.kind==='quantity'?plan.quantities.find(quantity=>quantity.id===view.quantityId)?.measurement:view.kind==='widget'?view.widget.spec:view;const bytes=payload?new TextEncoder().encode(JSON.stringify(payload)).length+(view.kind==='widget'?1024:0):0;gaps.push(...environmentGaps(adapter.descriptor,environment,bytes).filter(gap=>gap.kind==='resource'));}}
     return gaps;
   },
   select(input:CapabilityNeed,environment:CapabilityEnvironment=defaultCapabilityEnvironment()){
     environment=capabilityEnvironmentSchema.parse(environment);
     const need=capabilityNeedSchema.parse(input),candidates:CapabilityDescriptor[]=[],gaps:CapabilityGap[]=[];
     for(const {descriptor} of adapters.values()){
       if(!need.behaviors.every(value=>descriptor.behaviors.includes(value))||!need.assetKinds.every(value=>descriptor.assetKinds.includes(value))||!need.interactions.every(value=>descriptor.interactions.includes(value)))continue;
       const blocked=environmentGaps(descriptor,environment,need.inputBytes);if(blocked.length)gaps.push(...blocked);else candidates.push(structuredClone(descriptor));
     }
     if(!candidates.length&&!gaps.length)gaps.push({kind:'capability',requirement:need.behaviors.join(', ')||'data/interaction',reason:'No approved adapter supports this exact combination of behavior, data and interaction.',nextAction:'Use a source-linked conceptual alternative or record the missing capability; do not invent an engine.'});
     if(need.requestedEvidence!=='illustration')gaps.push({kind:'evidence',requirement:need.requestedEvidence,reason:'Adapter availability does not establish scientific reproduction.',nextAction:'Attach independent application-owned checks for the exact data/model/scope, or preview with an unverified teaching label.'});
     return {candidates,gaps};
   },
   async execute(view:RepresentationView,context:AdapterContext,environment:CapabilityEnvironment=defaultCapabilityEnvironment()):Promise<ExecutedRepresentationView>{
     environment=capabilityEnvironmentSchema.parse(environment);
     const ref=viewCapability(view),adapter=adapters.get(key(ref));if(!adapter||!adapter.descriptor.viewKinds.includes(view.kind))throw Error('The exact approved adapter is unavailable for this view.');
     if(environmentGaps(adapter.descriptor,environment).length)throw Error('The adapter environment is unavailable.');
     if(context.signal?.aborted)throw new DOMException('Representation cancelled.','AbortError');
     const output=await adapter.execute(view,context);
     if(context.signal?.aborted)throw new DOMException('Representation cancelled.','AbortError');
     if(output.id!==view.id||output.kind!==view.kind||new TextEncoder().encode(JSON.stringify(output)).length>adapter.descriptor.limits.maxOutputBytes)throw Error('The adapter returned an incompatible or oversized result.');
     if(output.kind==='source-guide'||output.kind==='composed-scene'||output.kind==='spatial-view')representationViewSchema.parse(output);
     if(output.kind==='composed-scene')validateComposedScene(output.scene,context.plan.anchors.map(anchor=>anchor.id));
     if(output.kind==='asset'&&(!hasCheckedAssetIntegrity(output.asset)||output.assetId!==(view as Extract<RepresentationView,{kind:'asset'}>).assetId||!context.assets.includes(output.asset)))throw Error('The adapter substituted an unbound asset.');
     if(output.kind==='spatial-view')preflightSpatialView(output.spatial,context.assets);
     if(output.kind==='quantity')validateScientificQuantity(output.quantity);
     if(output.kind==='statistical-chart'&&(JSON.stringify(output.model.spec)!==JSON.stringify((view as Extract<RepresentationView,{kind:'statistical-chart'}>).chart)||!output.model.series.every(series=>context.assets.some(asset=>asset.id===series.assetId&&asset.checksum.value===series.checksum))))throw Error('The chart adapter substituted its spec/data bindings.');
     if(output.kind==='widget'&&(JSON.stringify(output.widget)!==JSON.stringify((view as Extract<RepresentationView,{kind:'widget'}>).widget)||typeof output.result?.summary!=='string'||!Array.isArray(output.result?.metrics)))throw Error('The widget adapter returned incompatible inputs/results.');
     return output;
   },
 });
}
export type CapabilityRegistry=ReturnType<typeof createCapabilityRegistry>;
