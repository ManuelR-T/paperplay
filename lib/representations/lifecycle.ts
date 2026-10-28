import { validateRepresentationPlan, type RepresentationPlan } from '../../shared/representations';
import type { SourceDocument } from '../../shared/schema';
import type { WidgetEnvelope } from '../../shared/widgets';
import { computeWidget, type WidgetResult } from '../widgets/compute';

export type RepresentationFailure = { status:'invalid'|'unsupported'|'missing-data'|'cancelled'|'failed'; reason:string; nextAction:string; original:unknown; gaps?:string[] };
export type RepresentationOutcome<T> = { status:'ready'; value:T } | RepresentationFailure;
export type RepresentationArtifact = { format:'paperplay-representation-artifact'; schemaVersion:1; plan:RepresentationPlan };
export type RepresentationView = RepresentationPlan['views'][number];
export type ExecutedRepresentationView = { kind:'widget'; id:string; widget:WidgetEnvelope; result:WidgetResult } | Extract<RepresentationView,{kind:'source-guide'}>;
export type RepresentationRun = { artifact:RepresentationArtifact; views:ExecutedRepresentationView[]; evidence:{requested:RepresentationPlan['requestedEvidence']; verified:false} };

/** The two actual adapters share planning/build/run contracts; neither knows a discipline. */
const adapters = {
  'widget-v2': { version:'2.1.0' },
  'source-guide': { version:'1.0.0' },
} as const;
export function representationCapabilities() { return Object.entries(adapters).map(([id,value])=>({id,...value})); }
export function buildRepresentation(input:unknown,source:SourceDocument):RepresentationOutcome<RepresentationArtifact> {
  try {
    const version=input as {schemaVersion?:unknown};
    if(version?.schemaVersion!==1)return {status:'unsupported',reason:'This representation format/version is unavailable.',nextAction:'Keep or export the original file; open it in a compatible Paperplay version.',original:input};
    const plan=validateRepresentationPlan(input,source);
    const gaps=plan.execution.capabilities.filter(cap=>!representationCapabilities().some(available=>available.id===cap.id&&available.version===cap.version)).map(cap=>`${cap.id}@${cap.version}`);
    if(gaps.length)return {status:'unsupported',reason:'Required representation capabilities are unavailable.',nextAction:'Use an available representation or retain this file for a compatible runtime.',original:input,gaps};
    const missing=plan.execution.assetIds;
    if(missing.length)return {status:'missing-data',reason:'This representation needs explicitly supplied assets.',nextAction:'Supply the listed assets before computing; the source remains readable.',original:input,gaps:missing};
    return {status:'ready',value:{format:'paperplay-representation-artifact',schemaVersion:1,plan}};
  }catch(error){return {status:'invalid',reason:error instanceof Error?error.message:'Invalid representation.',nextAction:'Check the source anchors and configuration. The original file was retained.',original:input};}
}
export async function executeRepresentation(artifact:RepresentationArtifact,source:SourceDocument,options:{signal?:AbortSignal;compute?:(widget:WidgetEnvelope,signal?:AbortSignal)=>Promise<WidgetResult>}={}):Promise<RepresentationOutcome<RepresentationRun>> {
  // Revalidate imported/mutated artifacts; a caller-supplied artifact cannot skip build policy.
  if(artifact?.format!=='paperplay-representation-artifact'||artifact.schemaVersion!==1)return {status:'unsupported',reason:'This artifact version is unavailable.',nextAction:'Retain the original artifact and open it with a compatible runtime.',original:artifact};
  const built=buildRepresentation(artifact.plan,source);
  if(built.status!=='ready')return built;
  const views:ExecutedRepresentationView[]=[];
  try {
    if(typeof window!=='undefined'&&!options.compute&&built.value.plan.views.some(view=>view.kind==='widget'))return {status:'unsupported',reason:'Browser computation requires the trusted worker adapter.',nextAction:'Use a browser with worker support; no blocking fallback was started.',original:artifact.plan};
    for(const view of built.value.plan.views){
      if(options.signal?.aborted)throw new DOMException('Representation cancelled.','AbortError');
      if(view.kind==='source-guide')views.push(view);
      else {const result=options.compute?await options.compute(view.widget,options.signal):computeWidget(view.widget.spec,view.widget.seed);views.push({...view,result});}
    }
    if(options.signal?.aborted)throw new DOMException('Representation cancelled.','AbortError');
    return {status:'ready',value:{artifact:built.value,views,evidence:{requested:artifact.plan.requestedEvidence,verified:false}}};
  }catch(error){return {status:options.signal?.aborted?'cancelled':'failed',reason:error instanceof Error?error.message:'Representation failed.',nextAction:'Keep the source and prior valid representation; adjust inputs or retry explicitly.',original:artifact.plan};}
}

/** Pure inspection preserves unknown input; no storage writes, inference or code loading. */
export function inspectRepresentationFile(text:string,source:SourceDocument):RepresentationOutcome<RepresentationArtifact> {
  try {if(new TextEncoder().encode(text).length>256*1024)throw Error('Choose a representation below 256 KiB.');return buildRepresentation(JSON.parse(text),source);}
  catch(error){return {status:'invalid',reason:error instanceof Error?error.message:'Unreadable representation.',nextAction:'Keep the original file and correct its JSON before retrying.',original:text};}
}
