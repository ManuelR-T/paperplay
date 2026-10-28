import {validateSnapshot,type SourceDocument} from '../../shared/schema';
import {validateWidgetEnvelope} from '../../shared/widgets';
import {validateRepresentationPlan,MAX_REPRESENTATION_BYTES} from '../../shared/representations';
import {engineRegistry} from '../engines';
import {getWidgetDescriptor} from '../widgets/catalog';
import {RNG_VERSION} from '../widgets/compute';
import {DYNAMICS_SOLVER_VERSION} from '../../shared/dynamics';
import {STOCHASTIC_SOLVER_VERSION,STOCHASTIC_PRNG_VERSION,STOCHASTIC_UNIFORM_VERSION} from '../../shared/stochastic';
import {FIELD_SOLVER_VERSION} from '../../shared/physical-fields';
import {DISCRETE_ENGINE_VERSION} from '../../shared/discrete-algorithms';
import {viewCapability} from '../../shared/representation-capabilities';
import {artifactExperimentIdentitySchema} from '../../shared/artifact-experiment';
import type {ScientificExperienceEntry} from '../../shared/scientific-experience';
import {sha256Text} from '../artifacts/sdk-source';
export const jsonBytes=(value:unknown)=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
export function entryDefinition(entry:ScientificExperienceEntry){return entry.kind==='legacy'?entry.snapshot:entry.kind==='widget'?entry.widget:entry.kind==='representation'?entry.plan:entry.bundleJson;}
export async function definitionSha256(entry:ScientificExperienceEntry){const value=entryDefinition(entry);return sha256Text(typeof value==='string'?value:JSON.stringify(value));}
export async function executionMetadata(entry:ScientificExperienceEntry):Promise<ScientificExperienceEntry['executions']>{
 const rows:ScientificExperienceEntry['executions']=[];
 const add=async(id:string,engineId:string,engineVersion:string,input:unknown,parametersPath:string,seed:string|null,replayClass:'deterministic'|'seeded-stochastic'|'hardware-dependent',randomPolicy:string|null=null)=>{rows.push({id,engineId,engineVersion,requestSha256:await sha256Text(JSON.stringify(input)),parametersPath,seed,replayClass,randomPolicy});};
 if(entry.kind==='legacy'){const {snapshot}=entry,f=snapshot.figure;if(f.kind==='comparison')for(const [i,r]of f.runs.entries())await add(`run-${i}`,r.binding.engineId,r.binding.engineVersion,{input:f.input,parameters:r.binding.parameters,seed:snapshot.seed},`snapshot.figure.runs[${i}].binding.parameters`,String(snapshot.seed),f.input.kind==='matrix'?'hardware-dependent':'deterministic');else if(f.kind!=='steps'&&f.execution.mode==='computed')await add('primary',f.execution.binding.engineId,f.execution.binding.engineVersion,{input:f.input,parameters:f.execution.binding.parameters,seed:snapshot.seed},'snapshot.figure.execution.binding.parameters',String(snapshot.seed),f.input.kind==='matrix'?'hardware-dependent':'deterministic');}
 if(entry.kind==='widget'){const w=entry.widget;await add('widget',`widget-${w.spec.kind}`,getWidgetDescriptor(w.spec.kind).version,{spec:w.spec,seed:w.seed},'widget.spec',String(w.seed),w.spec.kind==='probability'?'seeded-stochastic':['equation','function','linear','signal','custom'].includes(w.spec.kind)?'hardware-dependent':'deterministic',w.spec.kind==='probability'?RNG_VERSION:null);}
 if(entry.kind==='representation')for(const [index,v]of entry.plan.views.entries()){const ref=viewCapability(v);let input:unknown=v,seed:string|null=null,version=ref.version,classification:'deterministic'|'seeded-stochastic'|'hardware-dependent'='deterministic',random:string|null=null;
  if(v.kind==='dynamics'){input=v.dynamics.request;version=DYNAMICS_SOLVER_VERSION;classification='hardware-dependent';}
  if(v.kind==='physical-field'){input=v.field.request;version=FIELD_SOLVER_VERSION;classification='hardware-dependent';}
  if(v.kind==='discrete-trace'){input=v.discrete.request;version=DISCRETE_ENGINE_VERSION;}
  if(v.kind==='stochastic'){input=v.stochastic.request;version=STOCHASTIC_SOLVER_VERSION;seed=v.stochastic.request.random.seed;classification='seeded-stochastic';random=STOCHASTIC_PRNG_VERSION+'/'+STOCHASTIC_UNIFORM_VERSION;}
  if(v.kind==='widget'){input={spec:v.widget.spec,seed:v.widget.seed};seed=String(v.widget.seed);classification=v.widget.spec.kind==='probability'?'seeded-stochastic':'hardware-dependent';random=v.widget.spec.kind==='probability'?RNG_VERSION:null;}
  if(v.kind==='dataset-study'||v.kind==='statistical-chart')classification='hardware-dependent';
  await add(v.id,ref.id,version,input,`plan.views[${index}]`,seed,classification,random);
 }
 if(entry.kind==='artifact'){const bundle=JSON.parse(entry.bundleJson),identity=artifactExperimentIdentitySchema.parse(bundle.identity);rows.push({id:'generated',engineId:identity.sdk.id,engineVersion:identity.runtime,requestSha256:identity.inputSha256,parametersPath:'bundle.inputJson (raw serialized order retained)',seed:String(identity.seed),randomPolicy:identity.randomPolicy,replayClass:'seeded-stochastic'});}
 return rows;
}
export function validateStudyDefinition(entry:Exclude<ScientificExperienceEntry,{kind:'artifact'}>,source:SourceDocument){
 if(entry.kind==='legacy'){if(jsonBytes(entry.snapshot)>256*1024)throw Error('Legacy definition exceeds 256 KiB.');return {...entry,snapshot:validateSnapshot(entry.snapshot,source,engineRegistry)};}
 if(entry.kind==='widget'){if(jsonBytes(entry.widget)>64*1024)throw Error('Widget definition exceeds 64 KiB.');return {...entry,widget:validateWidgetEnvelope(entry.widget,source)};}
 if(jsonBytes(entry.plan)>MAX_REPRESENTATION_BYTES)throw Error('Representation definition exceeds 256 KiB.');return {...entry,plan:validateRepresentationPlan(entry.plan,source)};
}
