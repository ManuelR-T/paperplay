import {capabilityRetrievalQuerySchema,capabilitySelectionSchema,CAPABILITY_RETRIEVAL_POLICY as P,type CapabilityRetrievalQuery,type CapabilitySelection,type CapabilitySelectionReceipt} from '../../shared/capability-retrieval';
import {getRetrievalCatalog,COMMON_CAPABILITY_MANIFEST,retrievalCatalogSha256} from './catalog';
import {brokerCanonicalJson} from '../../shared/external-broker';
import {sha256} from '../assets/local';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import {validateWidgetEnvelope,type WidgetEnvelope} from '../../shared/widgets';
import {sectionContext} from '../enrichment/sections';
import {datasetSourceFingerprint} from '../datasets/model';
import {WIDGET_CATALOG_VERSION} from '../widgets/catalog';
import {WHOLE_PAPER_SECTION_ID,type PaperFigureBrief,type ExistingPaperFigure} from '../enrichment/whole-paper';
export const retrievalHash=(value:unknown)=>sha256(brokerCanonicalJson(value));
const freeze=(value:unknown)=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
/** Supply the approved bank to Meta; only explicit target/version and format boundaries constrain capability availability. */
export async function retrieveCapabilities(raw:CapabilityRetrievalQuery):Promise<CapabilitySelection>{
 const query=capabilityRetrievalQuerySchema.parse(raw),catalog=getRetrievalCatalog(),artifact=query.purpose.startsWith('artifact-'),gaps:CapabilitySelection['gaps']=[],mandatory:string[]=[],repair=query.purpose==='widget-repair'||query.purpose==='widget-edit';
 const missing=(id:string,version:string|null,reason:string,blocking=true)=>gaps.push({id,version,blocking,reason,nextAction:'Retain the original/source-linked fallback. Choose a registered exact capability version or export a developer-extension request; do not invent SDK methods or install packages.'});
 const requireRef=(id:string,version:string)=>{const entry=catalog.find(e=>e.id===id);if(!entry||entry.version!==version){missing(id,version,!entry?'This exact capability ID is not available in this reviewed creation interface/catalog.':'This capability version is not available in this reviewed creation interface; no nearest-version substitution is permitted.');return;}if(artifact?entry.kind!=='generated-sdk':entry.kind==='generated-sdk'){missing(id,version,'This registered capability is not available through the selected generation format.');return;}mandatory.push(entry.id);};
 for(const ref of query.required??[])requireRef(ref.id,ref.version);
 if(artifact)requireRef('figure-sdk','1.0.0');
 if(repair&&!query.targetKind)missing('repair-target-kind',null,'Repair/edit needs an explicit existing widget kind.');
 if(query.targetKind){const target=catalog.find(e=>e.kind===query.targetKind);if(!target)missing(query.targetKind,query.targetVersion??null,'The existing/required target kind is not available in this reviewed creation interface.');else requireRef(target.id,query.targetVersion??target.version);}
 if(new Set(mandatory).size>P.maxSelected)missing('selection-capacity',null,'The explicit exact requirements exceed the supported capability manifest shape.');
 // Planning receives every approved widget type, independently of source vocabulary.
 // Repair/edit keeps its explicit existing target; generated code receives the complete approved drawing SDK.
 const chosen=artifact||repair?[...new Set(mandatory)]:catalog.filter(entry=>entry.kind!=='generated-sdk').map(entry=>entry.id);
 let remainingExamples=P.maxExamples;const selected:CapabilitySelection['selected']=chosen.map(id=>{const entry=catalog.find(e=>e.id===id)!,examples=entry.examples.slice(0,remainingExamples);remainingExamples-=examples.length;return {id:entry.id,version:entry.version,kind:entry.kind,descriptor:entry.descriptor,template:entry.template,examples,score:0,reasons:[mandatory.includes(id)?'Explicit exact target/requirement retained.':'Available in the complete approved bank; Meta chooses the appropriate figure, parameters and placement.','Availability does not establish scientific applicability or execution fidelity.']};});
 const content={common:COMMON_CAPABILITY_MANIFEST,selected},serialized=JSON.stringify(content),bytes=new TextEncoder().encode(serialized).length;if(bytes>P.maxContentBytes)throw Error('Approved capability content exceeds its technical 64 KiB transport ceiling.');
 const identity={policyVersion:'2.0.0' as const,catalogSha256:await retrievalCatalogSha256(),context:{sha256:await sha256(query.context),sourceFingerprint:query.sourceFingerprint??null,sectionId:query.sectionId??null},querySha256:await retrievalHash(query),purpose:query.purpose},selectionId=await retrievalHash(identity),body={format:'paperplay-capability-selection' as const,schemaVersion:1 as const,...identity,selectionId,common:COMMON_CAPABILITY_MANIFEST,selected,gaps,contentSha256:await retrievalHash(content),metrics:{selectedCapabilities:selected.length,selectedExamples:selected.reduce((n,e)=>n+e.examples.length,0),contentCharacters:serialized.length,contentBytes:bytes}};
 const result=capabilitySelectionSchema.parse({...body,selectionSha256:await retrievalHash(body)});freeze(result);return result;
}
/** Recompute fixed selection when context is available. A changed descriptor/example cannot install a catalog entry. */
export async function validateCapabilitySelection(raw:unknown,query?:CapabilityRetrievalQuery):Promise<CapabilitySelection>{
 if(new TextEncoder().encode(JSON.stringify(raw)).length>96*1024)throw Error('Capability selection exceeds its transport ceiling.');const selection=capabilitySelectionSchema.parse(raw),{selectionSha256,...body}=selection;if(await retrievalHash(body)!==selectionSha256||selection.catalogSha256!==await retrievalCatalogSha256()||selection.selectionId!==await retrievalHash({policyVersion:selection.policyVersion,catalogSha256:selection.catalogSha256,context:selection.context,querySha256:selection.querySha256,purpose:selection.purpose}))throw Error('Capability selection identity/catalog changed.');
 if(new Set(selection.selected.map(e=>e.id)).size!==selection.selected.length||selection.selected.some(e=>new Set(e.examples.map(x=>x.id)).size!==e.examples.length)||(selection.purpose.startsWith('artifact-')?selection.selected.some(e=>e.kind!=='generated-sdk'):selection.selected.some(e=>e.kind==='generated-sdk')))throw Error('Capability selection duplicates entries/examples or changes creation format.');
 if(query){const expected=await retrieveCapabilities(query);if(brokerCanonicalJson(expected)!==brokerCanonicalJson(selection))throw Error('Capability selection belongs to another exact context/target.');}
 else{if(brokerCanonicalJson(selection.common)!==brokerCanonicalJson(COMMON_CAPABILITY_MANIFEST))throw Error('Capability common manifest changed.');for(const entry of selection.selected){const original=getRetrievalCatalog().find(e=>e.id===entry.id&&e.version===entry.version&&e.kind===entry.kind);if(!original||brokerCanonicalJson(entry.descriptor)!==brokerCanonicalJson(original.descriptor)||brokerCanonicalJson(entry.template)!==brokerCanonicalJson(original.template)||entry.examples.some(e=>!original.examples.some(o=>brokerCanonicalJson(e)===brokerCanonicalJson(o))))throw Error('A selected descriptor/template/example is not application-owned.');}const content={common:selection.common,selected:selection.selected},serialized=JSON.stringify(content);if(await retrievalHash(content)!==selection.contentSha256||selection.metrics.contentCharacters!==serialized.length||selection.metrics.contentBytes!==new TextEncoder().encode(serialized).length||selection.metrics.selectedCapabilities!==selection.selected.length||selection.metrics.selectedExamples!==selection.selected.reduce((n,e)=>n+e.examples.length,0)||selection.metrics.selectedExamples>P.maxExamples)throw Error('Capability content digest/size changed.');}
 freeze(selection);return selection;
}
/** Use only after full selection/context or durable receipt validation; this never installs or executes a capability. */
export function validateRetrievedWidgetKind(kind:string,selection:CapabilitySelection|CapabilitySelectionReceipt){if(!selection.selected.some(e=>e.kind===kind))throw Error('The proposed widget kind was not in the frozen capability selection.');return kind;}
export async function enrichmentRetrievalQuery(input:{source:SourceDocument;sectionId:string;action:'plan'|'repair'|'edit';feedback:string;target?:WidgetEnvelope;scope?:'paper-outline'|'paper-figure';figureBrief?:PaperFigureBrief;existingFigures?:ExistingPaperFigure[]}):Promise<CapabilityRetrievalQuery>{
 const source=validateDocument(input.source),target=input.target?validateWidgetEnvelope(input.target,source):undefined,sourceFingerprint=await datasetSourceFingerprint(source);
 if(input.scope&&(input.sectionId!==WHOLE_PAPER_SECTION_ID||input.action!=='plan'||target))throw Error('Whole-paper capabilities require a complete-paper plan.');
 // The entire source is sent by the provider. Retrieval needs only its exact identity,
 // not a second excerpt or a duplicate copy of its potentially large text.
 const context=input.scope?JSON.stringify({coverage:'complete saved paper',scope:input.scope,sourceFingerprint,figureBriefSha256:input.figureBrief?await retrievalHash(input.figureBrief):null,existingFiguresSha256:input.existingFigures?await retrievalHash(input.existingFigures):null}):sectionContext(source,input.sectionId,target?.source.blockId).text;
 return capabilityRetrievalQuerySchema.parse({context,sourceFingerprint,sectionId:input.sectionId,concept:input.feedback.trim(),purpose:`widget-${input.action}`,...(target?{targetKind:target.spec.kind,targetVersion:WIDGET_CATALOG_VERSION}:{})});
}
export async function generationRetrievalQuery(input:{source:SourceDocument;sectionId:string;brief:string;scope?:'paper'}):Promise<CapabilityRetrievalQuery>{
 const source=validateDocument(input.source),sourceFingerprint=await datasetSourceFingerprint(source);
 if(input.scope&&input.sectionId!==WHOLE_PAPER_SECTION_ID)throw Error('Whole-paper generation requires the complete-paper scope.');
 const context=input.scope?JSON.stringify({coverage:'complete saved paper',scope:input.scope,sourceFingerprint}):sectionContext(source,input.sectionId).text;
 return capabilityRetrievalQuerySchema.parse({context,sourceFingerprint,sectionId:input.sectionId,concept:input.brief.trim(),purpose:'artifact-generate',targetKind:'generated-sdk',targetVersion:'1.0.0'});
}
