import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createExperimentBundle} from '../lib/snapshots';
import {createArtifactExperimentIdentity,createArtifactCacheRecord} from '../shared/artifact-experiment';
import {preparedPapers} from '../data/papers';
import {inspectAdoptionRecord,type AdoptionMigrationInput} from '../lib/adoption/compatibility';
import {runAdoptionMigration,validateAdoptionMigrationReport,adoptionCacheInvalidations,type AdoptionCacheVersions} from '../lib/adoption/migration';
import {readingWidgets} from '../lib/experiments/workspace';
import {emptyEnrichmentState,enrichmentFingerprint} from '../lib/enrichment/state';
import {createStatisticalExample} from '../lib/representations/statistical-examples';
import {serializeDataStudy} from '../lib/representations/data-study';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {createArtifactExperimentBundle} from '../lib/artifacts/experiment-bundle';
import {createExtractionManifestFromSource} from '../lib/extraction/model';
import {createScientificExperience} from '../lib/experiences/bundle';
import {sha256Text} from '../lib/artifacts/sdk-source';
const item=(id:string,kind:AdoptionMigrationInput['kind'],value:unknown):AdoptionMigrationInput=>({id,kind,serialized:JSON.stringify(value)});
test('release 1.1.0 snapshot fixtures retain source/engine binding, exact originals and zero execution in deterministic staged report',async()=>{
 const snapshots=JSON.parse(readFileSync('tests/fixtures/release-1.1.0-snapshots.json','utf8')) as unknown[];
 const inputs=snapshots.map((value,index)=>item(`release-1.1.0-${index}`,'snapshot',value)),before=structuredClone(inputs);
 const report=await runAdoptionMigration(inputs,{fromVersion:'1.1.0'});assert.ok(report.records.length>=3);assert.ok(report.records.every(x=>x.disposition==='compatible'));assert.equal(report.storageWrites,0);assert.equal(report.executionCount,0);assert.deepEqual(inputs,before);
 assert.equal((await validateAdoptionMigrationReport(report)).reportSha256,report.reportSha256);assert.equal((await runAdoptionMigration(inputs,{fromVersion:'1.1.0'})).reportSha256,report.reportSha256);
 for(let i=0;i<inputs.length;i++)assert.equal(report.records[i].sha256,await sha256Text(inputs[i].serialized));
 await assert.rejects(validateAdoptionMigrationReport({...report,storageWrites:1}));await assert.rejects(validateAdoptionMigrationReport({...report,toVersion:'tampered'}));
});
test('v2 declarative widgets/workspace and old accepted enrichment remain compatible without rewriting pending references',async()=>{
 const source=preparedPapers[0].document,widget=readingWidgets(source)[0],enrichment={...emptyEnrichmentState(await enrichmentFingerprint(source)),catalogVersion:'2.0.0',accepted:[widget],pending:{requestId:'existing-request-1234',sectionId:'section',action:'plan',feedback:'',uncertain:true}};
 const inputs=[item('widget','widget',widget),item('workspace-v2','workspace',{format:'paperplay-workspace',version:2,widgets:[widget]}),item('accepted-old-enrichment','enrichment',enrichment),item('source','source',source),item('reading-state-v1','reading-state',{schemaVersion:1,documentId:source.id,sourceVersion:source.sourceVersion,updatedAt:1,position:{blockId:source.blocks[0].id,scrollY:25},figures:[]})];
 const report=await runAdoptionMigration(inputs,{source,fromVersion:'1.1.0'});assert.ok(report.records.every(x=>x.disposition==='compatible'));assert.equal(JSON.parse(inputs[2].serialized).catalogVersion,'2.0.0');assert.equal(JSON.parse(inputs[2].serialized).pending.uncertain,true);
 const unknown=item('unknown','workspace',{format:'paperplay-workspace',version:99,widgets:[widget]});const rejected=await inspectAdoptionRecord(unknown,{source});assert.equal(rejected.disposition,'incompatible');assert.equal(rejected.original,unknown.serialized);
});
test('v1 data study, extraction and v1 experiment/artifact/experience formats stay recoverable without executing imported code or restoring receipts',async()=>{
 const statistical=await createStatisticalExample('biology'),dataStudy=serializeDataStudy(statistical.source,statistical.plan);
 const generated=await createDynamicSequenceArtifact(),artifact=await createArtifactExperimentBundle({...generated,includeSource:true}),evidence=await createExtractionManifestFromSource(generated.source),experience=await createScientificExperience({source:generated.source,entries:[{id:'accepted',kind:'artifact',artifact:generated.artifact}],includeSource:true});
 const legacy=JSON.parse(readFileSync('tests/fixtures/release-1.1.0-snapshots.json','utf8'))[0],legacyBundle=await createExperimentBundle({snapshot:legacy,includeSource:false,includePdf:false});
 const entries=[{id:'data-study-v1',kind:'data-study' as const,serialized:dataStudy},item('extraction-v1','extraction',evidence),{id:'artifact-v1',kind:'artifact-bundle' as const,serialized:artifact},{id:'experience-v1',kind:'scientific-experience' as const,serialized:experience},{id:'legacy-bundle-v1',kind:'experiment-bundle' as const,serialized:legacyBundle}];
 const report=await runAdoptionMigration(entries,{fromVersion:'1.1.0'});assert.equal(report.records[0].disposition,'compatible');assert.equal(report.records[1].disposition,'compatible');assert.equal(report.records[2].disposition,'requires-recompile');assert.deepEqual(report.records[2].invalidations,['build']);assert.equal(report.records[3].disposition,'read-only');assert.equal(report.records[4].disposition,'compatible');assert.equal(report.executionCount,0);
 const missing=await inspectAdoptionRecord({id:'omitted-source',kind:'artifact-bundle',serialized:await createArtifactExperimentBundle(generated)});assert.equal(missing.disposition,'read-only');
});
test('unsupported versions, corrupt originals and bounds never become destructive migration instructions',async()=>{
 const raw='{"format":"future-format","schemaVersion":99,"privateNotes":"keep exact bytes"}',input={id:'future',kind:'scientific-experience' as const,serialized:raw},result=await inspectAdoptionRecord(input);assert.equal(result.disposition,'incompatible');assert.equal(result.original,raw);
 const report=await runAdoptionMigration([input],{fromVersion:'future'});assert.deepEqual(report.rollback.automaticRewrites,false);assert.equal(report.rollback.originalsRetained,true);assert.equal('privateNotes'in report,false);assert.ok(!JSON.stringify(report).includes('keep exact bytes'));
 await assert.rejects(runAdoptionMigration([input,input],{fromVersion:'1.1.0'}));await assert.rejects(runAdoptionMigration(Array.from({length:33},(_,i)=>({...input,id:`f-${i}`})),{fromVersion:'1.1.0'}));
});
test('cache invalidations scope quality to reports, execution inputs to execution/report and compiler dependencies to all derived records',()=>{
 const before:AdoptionCacheVersions={source:'s',artifact:'a',sdk:'1',compiler:'1',runtime:'1',dependencies:'d',assets:'d',input:'i',seed:'42',randomPolicy:'1',qualityPolicy:'1'};
 assert.deepEqual(adoptionCacheInvalidations(before,before),[]);assert.deepEqual(adoptionCacheInvalidations(before,{...before,qualityPolicy:'2'}),['report']);
 for(const key of ['runtime','assets','input','seed','randomPolicy'] as const)assert.deepEqual(adoptionCacheInvalidations(before,{...before,[key]:'changed'}),['execution','report']);
 for(const key of ['source','artifact','sdk','compiler','dependencies'] as const)assert.deepEqual(adoptionCacheInvalidations(before,{...before,[key]:'changed'}),['build','execution','report']);
});

test('persisted build receipts and version-stale cache rows cannot become current execution authority',async()=>{
 const fixture=await createDynamicSequenceArtifact(),identity=await createArtifactExperimentIdentity(fixture);
 const build=await createArtifactCacheRecord('build',identity,{status:'admitted',compilerVersion:identity.compiler,artifactSha256:identity.artifactSha256});
 const checked=await inspectAdoptionRecord(item('build','artifact-cache',build));assert.equal(checked.disposition,'requires-recompile');assert.match(checked.reason,/private compiler receipt/);
 const staleIdentity={...identity,compiler:'unsupported-compiler@99.0.0'},stale=await createArtifactCacheRecord('build',staleIdentity,{status:'admitted',compilerVersion:staleIdentity.compiler,artifactSha256:identity.artifactSha256});
 const rejected=await inspectAdoptionRecord(item('unknown-cache','artifact-cache',stale));assert.equal(rejected.disposition,'read-only');assert.deepEqual(rejected.invalidations,['build','execution','report']);assert.equal(rejected.original,JSON.stringify(stale));
});
