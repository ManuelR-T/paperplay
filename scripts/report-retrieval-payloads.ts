import {writeFile} from 'node:fs/promises';
import {readScientificCorpus} from '../lib/evaluation/scientific-corpus';
import {getPreparedPaper} from '../data/papers';
import {createDatasetExample} from '../lib/representations/dataset-examples';
import {buildSourceSections} from '../lib/enrichment/sections';
import {enrichmentRetrievalQuery,generationRetrievalQuery,retrieveCapabilities} from '../lib/retrieval/selection';
import {createCapabilitySelectionReceipt,measureModelRequest} from '../lib/retrieval/manifest';
import {retrievalCatalogSha256} from '../lib/retrieval/catalog';
import {CAPABILITY_RETRIEVAL_POLICY} from '../shared/capability-retrieval';
import {getWidgetDesignCapabilities} from '../lib/widgets/design-capabilities';
import {enrichmentProviderRequest,enrichmentPromptMetrics} from '../server/enrichment/provider';
import {generationPromptMetrics} from '../server/artifact-generation/provider';
import type {SourceDocument} from '../shared/schema';
/** Offline only. Importing pure provider request builders never constructs a provider client. */
const corpus=readScientificCorpus(),model='offline-configured-model-placeholder';
const cases:unknown[]=[];
for(const paper of corpus.papers){
 if(paper.split==='held-out'){
  cases.push({id:paper.id,split:paper.split,status:'deferred-to-frozen-evaluation-PP113',sourceContextBasis:'No held-out body/abstract/asset read by this script.',payload:null,actualUsage:null,inferenceCalls:0,reason:'Keep held-out sources out of retrieval-policy tuning. Freeze implementation/catalog/prompt hashes before admitting and measuring these sources in PP113.'});continue;
 }
 let source:SourceDocument|undefined,basis:string;
 if(paper.id==='C1'||paper.id==='C2'){source=getPreparedPaper(paper.id==='C1'?'priority-search-trees':'adaptive-mergesort')!.document;basis='Existing prepared/public saved excerpt; not complete publication.';}
 else if(paper.id==='B1'){source=(await createDatasetExample('reported')).source;basis='Existing admitted short Figure11 caption/attribution card; not full paper or raw recordings.';}
 else basis='Frozen development intake metadata only, not publication body/abstract. This measurement cannot establish real paper coverage.';
 const sectionId=source?buildSourceSections(source)[0].id:`intake-${paper.id}`,context=JSON.stringify({scope:'DEVELOPMENT INTAKE METADATA ONLY, NOT ORIGINAL PAPER TEXT',paperId:paper.id,title:paper.title,concept:paper.concept,sourceAdmission:paper.source.admission,selectedPassages:[],missingSource:'Import the exact admitted source before requesting a source-grounded proposal.'});
 const query=source?await enrichmentRetrievalQuery({source,sectionId,action:'plan',feedback:''}):{context,sectionId,purpose:'widget-plan' as const,concept:paper.concept};
 const selected=await retrieveCapabilities(query),receipt=await createCapabilitySelectionReceipt(selected),input={action:'plan' as const,context:query.context,feedback:'',retrieval:selected};
 const request=enrichmentProviderRequest(input,model),metrics=enrichmentPromptMetrics(input,model);
 // Counterfactual shares current fixed instructions/schema/model and swaps only the
 // selected content for the historical all-template catalog. It is never submitted.
 const broad={...request,input:JSON.stringify({action:'plan',...getWidgetDesignCapabilities(),selectedSource:JSON.parse(query.context),feedback:''})},baseline=measureModelRequest({request:broad,phase:'planning',maxOutputTokens:6000});
 const genQuery=source?await generationRetrievalQuery({source,sectionId,brief:'Explain the selected concept with bounded synthetic controls.'}):{context,sectionId,purpose:'artifact-generate' as const,concept:paper.concept,targetKind:'generated-sdk',targetVersion:'1.0.0'},generated=await retrieveCapabilities(genQuery),generation=generationPromptMetrics({context:genQuery.context,brief:genQuery.concept??'',attempt:1,retrieval:generated},model);
 const unsupported=await retrieveCapabilities({...query,required:[{id:`unavailable-${paper.id.toLowerCase()}-engineering-probe`,version:'1.0.0'}]});
 cases.push({id:paper.id,split:paper.split,status:source?'measured-existing-saved-context':'measured-metadata-context-only',sourceContextBasis:basis!,sourceCharacters:query.context.length,sourceBytes:new TextEncoder().encode(query.context).length,selectionReceipt:receipt,planning:metrics,counterfactualBroadCatalog:baseline,planningBytesSaved:baseline.bytes-metrics.bytes,generation,generatedSelection:{selectionSha256:generated.selectionSha256,selectedIds:generated.selected.map(e=>`${e.id}@${e.version}`),contentBytes:generated.metrics.contentBytes},unsupportedExactRequirementProbe:{syntheticEngineeringProbe:true,blockingGaps:unsupported.gaps.filter(g=>g.blocking).map(g=>({id:g.id,version:g.version,reason:g.reason})),providerCreated:false},actualUsage:null,inferenceCalls:0,creationDisposition:source?'Measured locally only; explicit reviewed action would still be required.':'No source-grounded provider request authorized from metadata-only fixture.'});
}
const report={format:'paperplay-retrieval-payload-report',schemaVersion:1,phase:'development-policy',corpusId:corpus.id,splitSha256:corpus.splitSha256,catalogSha256:await retrievalCatalogSha256(),policy:CAPABILITY_RETRIEVAL_POLICY,modelIdentity:model,scope:'Offline full-request serialization measurements, not model execution, scientific verification or held-out performance.',inferenceCalls:0,actualUsage:null,cases,limitations:['All12 frozen membership entries are recorded, but four held-out payload/usage measurements remain null until PP113 freezes and evaluates the policy.','Only C1/C2 saved excerpts and B1 attribution card are existing source contexts; other development entries measure explicitly labeled intake metadata only.','Counterfactual broad planning body holds current instructions/schema/model fixed; this is a size comparison, not a reconstructed historical network trace.','Byte/character counts include serialized instructions, input, response schema and included feedback; offline model identity is an explicit placeholder.','Token estimates/reservations are not measured provider usage or a financial quote; local tests and this report make zero model calls.','Generated SDK source remains necessary common code. Bounding retrieval does not promise every generation prompt becomes smaller.']};
const text=JSON.stringify(report,null,2)+'\n',path=process.argv[2];if(path)await writeFile(path,text);else process.stdout.write(text);
