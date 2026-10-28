/** Provider-free, read-only fixture inspection. Never reads browser storage or credentials. */
import {readFile,writeFile} from 'node:fs/promises';
import {preparedPapers} from '../data/papers';
import {readingWidgets} from '../lib/experiments/workspace';
import {emptyEnrichmentState,enrichmentFingerprint} from '../lib/enrichment/state';
import {buildSourceSections} from '../lib/enrichment/sections';
import {createExperimentBundle} from '../lib/snapshots';
import {createStatisticalExample} from '../lib/representations/statistical-examples';
import {serializeDataStudy} from '../lib/representations/data-study';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {createArtifactExperimentBundle} from '../lib/artifacts/experiment-bundle';
import {createExtractionManifestFromSource} from '../lib/extraction/model';
import {createScientificExperience} from '../lib/experiences/bundle';
import {createArtifactCacheRecord,createArtifactExperimentIdentity} from '../shared/artifact-experiment';
import {runAdoptionMigration,adoptionCacheInvalidations,type AdoptionCacheVersions} from '../lib/adoption/migration';
import type {AdoptionMigrationInput} from '../lib/adoption/compatibility';
import {sha256Text} from '../lib/artifacts/sdk-source';

const args=process.argv.slice(2);
if(args.length>1||args[0]&&!/^--output=.+$/.test(args[0]))throw Error('Use report:adoption -- --output=NEW_REPORT.json, or omit the output for JSON on stdout.');
const item=(id:string,kind:AdoptionMigrationInput['kind'],value:unknown):AdoptionMigrationInput=>({id,kind,serialized:JSON.stringify(value)});
const releaseFixtureText=await readFile('tests/fixtures/release-1.1.0-snapshots.json','utf8'),snapshots=JSON.parse(releaseFixtureText);
const release=await runAdoptionMigration(snapshots.map((value:unknown,index:number)=>item(`release-1.1.0-${index}`,'snapshot',value)),{fromVersion:'1.1.0',toVersion:'scientific-architecture-v1'});

const source=preparedPapers[0].document,widget=readingWidgets(source)[0];
const enrichment={...emptyEnrichmentState(await enrichmentFingerprint(source)),catalogVersion:'2.0.0',accepted:[widget],pending:{requestId:'authored-migration-reference',sectionId:buildSourceSections(source)[0].id,action:'plan',feedback:'',uncertain:true}};
const scoped=await runAdoptionMigration([
 item('source','source',source),
 item('import-record-ready','import-record',{id:source.id,pipelineVersion:'m2-v1',stage:'ready',updatedAt:0,source}),
 item('reading-state-v1','reading-state',{schemaVersion:1,documentId:source.id,sourceVersion:source.sourceVersion,updatedAt:0,position:{blockId:source.blocks[0].id,scrollY:25},figures:[]}),
 item('widget-v2','widget',widget),
 item('workspace-v2','workspace',{format:'paperplay-workspace',version:2,widgets:[widget]}),
 item('accepted-enrichment-v2','enrichment',enrichment),
 item('unknown-workspace-version','workspace',{format:'paperplay-workspace',version:99,widgets:[widget]}),
],{source,fromVersion:'1.1.0',toVersion:'scientific-architecture-v1'});

const statistical=await createStatisticalExample('biology'),generated=await createDynamicSequenceArtifact();
const identity=await createArtifactExperimentIdentity(generated),currentBuild=await createArtifactCacheRecord('build',identity,{status:'admitted',compilerVersion:identity.compiler,artifactSha256:identity.artifactSha256});
const oldIdentity={...identity,compiler:'unsupported-compiler@99.0.0'},oldBuild=await createArtifactCacheRecord('build',oldIdentity,{status:'admitted',compilerVersion:oldIdentity.compiler,artifactSha256:identity.artifactSha256});
// This authored fixture fixes export metadata for byte-reproducible reports; user exports are never rewritten.
const legacyBundle={...JSON.parse(await createExperimentBundle({snapshot:snapshots[0],includeSource:false,includePdf:false})),createdAt:'2026-10-28T00:00:00.000Z'};
const portable=await runAdoptionMigration([
 {id:'data-study-v1',kind:'data-study',serialized:serializeDataStudy(statistical.source,statistical.plan)},
 {id:'data-study-v2',kind:'data-study',serialized:await readFile('data/weak-acid-example.json','utf8')},
 {id:'legacy-bundle-v1',kind:'experiment-bundle',serialized:JSON.stringify(legacyBundle)},
 {id:'artifact-with-source-v1',kind:'artifact-bundle',serialized:await createArtifactExperimentBundle({...generated,includeSource:true})},
 {id:'artifact-without-source-v1',kind:'artifact-bundle',serialized:await createArtifactExperimentBundle(generated)},
 {id:'experience-v1',kind:'scientific-experience',serialized:await createScientificExperience({source:generated.source,entries:[{id:'authored',kind:'artifact',artifact:generated.artifact}],includeSource:true})},
 item('extraction-v1','extraction',await createExtractionManifestFromSource(generated.source)),
 item('persisted-build-metadata','artifact-cache',currentBuild),
 item('unsupported-compiler-cache','artifact-cache',oldBuild),
 {id:'future-format-original','kind':'scientific-experience',serialized:'{"format":"future-scientific-experience","schemaVersion":99,"authoredFixture":"Retain original bytes"}'},
],{fromVersion:'1.1.0',toVersion:'scientific-architecture-v1'});

const versions:AdoptionCacheVersions={source:'source-v1',artifact:'artifact-v1',sdk:'sdk-v1',compiler:'compiler-v1',runtime:'runtime-v1',dependencies:'lock-v1',assets:'assets-v1',input:'input-v1',seed:'42',randomPolicy:'random-v1',qualityPolicy:'quality-v1'};
const runs=[release,scoped,portable],report={format:'paperplay-adoption-fixture-staging',schemaVersion:1,scope:'Deterministic authored/public fixture inspection, not a migration of user storage or a release approval.',runs,totals:{records:runs.reduce((n,r)=>n+r.records.length,0),storageWrites:0,generatedExecutions:0,providerCalls:0},cacheInvalidationExamples:{unchanged:adoptionCacheInvalidations(versions,versions),qualityOnly:adoptionCacheInvalidations(versions,{...versions,qualityPolicy:'quality-v2'}),runtimeOnly:adoptionCacheInvalidations(versions,{...versions,runtime:'runtime-v2'}),compilerOnly:adoptionCacheInvalidations(versions,{...versions,compiler:'compiler-v2'})},rollback:{automaticWrites:false,originalRecordsRetained:true,notesAndSourcesDeletionCandidates:false,action:'Keep original exports and the prior compatible app. Newer/unsupported formats remain original read-only records; derived cache metadata cannot restore execution or scientific authority.'},limitations:['Fixture construction seals bounded metadata and creates inert serialized definitions; no chemistry solver, generated interpreter, Worker or provider is launched.','Compatible means accepted by existing record validators; it is not scientific verification.','The legacy M2 start endpoint still rejects retry under creation cutoff; its existing status/cancel paths remain available. Enrichment/generated idempotent accepted recovery is supported under cutoff.','No Railway, public access, deployment, user-data rewrite or human-study acceptance occurs.']};
const tracedReport={...report,fixtureFiles:[{path:'tests/fixtures/release-1.1.0-snapshots.json',sha256:await sha256Text(releaseFixtureText),bytes:new TextEncoder().encode(releaseFixtureText).length}]};
const text=JSON.stringify(tracedReport,null,2)+'\n';
if(args[0]){const output=args[0].slice('--output='.length);await writeFile(output,text,{flag:'wx'});console.log(JSON.stringify({status:'dry-run-written',output,records:report.totals.records,storageWrites:0,generatedExecutions:0,providerCalls:0}));}else process.stdout.write(text);
