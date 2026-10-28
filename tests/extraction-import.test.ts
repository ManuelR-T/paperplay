import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {normalizeSource,sha256} from '../lib/import/normalize';
import {createExtractionManifest,validateExtractionEvidenceManifest,ExtractionEvidenceError} from '../lib/extraction/model';
import {rebindArxivPdfSource} from '../lib/import/arxiv-client';
import {createImportStorage} from '../lib/import-storage';
import {ImportController} from '../lib/import-controller';
import {ANALYSIS_PIPELINE_VERSION} from '../shared/import-types';
import type {ExtractionEvidenceEntry} from '../shared/extraction-evidence';

async function fixture(){
 const text='An independently authored extraction-boundary fixture retains the source text and its original page coordinate mapping. '.repeat(3);
 const original=new Blob(['%PDF-1.7\nauthored raw-byte identity fixture\n'],{type:'application/pdf'}),digest=await sha256(new Uint8Array(await original.arrayBuffer()));
 const reconstruction={version:'pdf-layout-v3' as const,pages:[{page:1,width:600,height:800,regions:[{id:'line-one',text,x:17,y:70,width:200,height:12}],coordinatesComplete:true}]};
 const source=await normalizeSource({kind:'pdf',title:'Authored extraction boundary',pageCount:1,blocks:[{id:'paragraph',kind:'paragraph',page:1,text}],identity:digest,reconstruction});
 const entry:ExtractionEvidenceEntry={id:'text-one',kind:'text',blockId:'paragraph',label:'Authored boundary paragraph',state:'retained',basis:'raw-pdf-text',locator:{kind:'source-block',blockId:'paragraph'},losses:[]};
 const manifest=await createExtractionManifest(source,{sha256:digest,byteLength:original.size,mediaType:'application/pdf',url:null,name:'fixture.pdf'},[entry]);
 return {source,original,manifest,reconstruction};
}
test('arXiv PDF identity rebinding retains reconstruction, original bytes and a freshly source-bound evidence manifest',async()=>{
 const f=await fixture(),restored=await rebindArxivPdfSource({source:f.source,original:f.original,originalName:'fixture.pdf',extractionEvidence:f.manifest},{kind:'pdf',pdfBase64:'',originalUrl:'https://arxiv.org/pdf/2601.00001v1',arxivId:'2601.00001v1'});
 assert.equal(restored.source.source.kind,'arxiv');assert.notEqual(restored.source.id,f.source.id);assert.deepEqual(restored.source.reconstruction,f.reconstruction);assert.equal(restored.original,f.original);assert.deepEqual(restored.source.blocks,f.source.blocks);
 assert.equal(restored.extractionEvidence?.original.sha256,f.manifest.original.sha256);assert.notEqual(restored.extractionEvidence?.manifestSha256,f.manifest.manifestSha256);await validateExtractionEvidenceManifest(restored.extractionEvidence,restored.source);
 await assert.rejects(rebindArxivPdfSource({...restored,extractionEvidence:{...restored.extractionEvidence!,manifestSha256:'0'.repeat(64)}},{kind:'pdf',pdfBase64:'',originalUrl:'https://arxiv.org/pdf/2601.00001v1',arxivId:'2601.00001v1'}),/checksum/);
});
test('an unknown or corrupt saved evidence sidecar cannot hide the source or silently lose the original sidecar',async()=>{
 const f=await fixture(),storage=createImportStorage({indexedDB:new IDBFactory(),name:'extraction-soft-recovery'}),unknown={...f.manifest,schemaVersion:999};
 await storage.put({id:f.source.id,source:f.source,original:f.original,originalName:'fixture.pdf',pipelineVersion:ANALYSIS_PIPELINE_VERSION,stage:'ready',updatedAt:1000,extractionEvidence:unknown as any});
 const saved=(await storage.get(f.source.id))!;assert.deepEqual(saved.source,f.source);assert.equal(saved.extractionEvidence,undefined);assert.deepEqual(saved.extractionEvidenceRecovery?.original,unknown);assert.deepEqual(new Uint8Array(await saved.original!.arrayBuffer()),new Uint8Array(await f.original.arrayBuffer()));
 await storage.put({...saved,updatedAt:2000});const again=(await storage.list())[0];assert.deepEqual(again.extractionEvidenceRecovery?.original,unknown);assert.equal(again.stage,'ready');
 await storage.put({...saved,extractionEvidence:f.manifest,extractionEvidenceRecovery:undefined,updatedAt:3000});assert.equal((await storage.get(saved.id))?.extractionEvidence?.manifestSha256,f.manifest.manifestSha256);
});
test('an image-only extraction failure keeps raw-byte loss evidence without creating a readable source or requesting inference',async()=>{
 const f=await fixture(),manifest=await createExtractionManifest(null,f.manifest.original,[],{losses:['No extractable text; OCR is not implemented.']}),storage=createImportStorage({indexedDB:new IDBFactory(),name:'extraction-failure'});let calls=0;
 const controller=new ImportController({storage,extractPdf:async()=>{throw new ExtractionEvidenceError('No extractable text; original retained.',manifest,f.original,'scan.pdf');},importArxiv:async()=>{throw Error('unused');},fetch:async()=>{calls++;throw Error('No inference permitted.');}});controller.activate();
 await controller.importPdf(new File([f.original],'scan.pdf',{type:'application/pdf'}),{analyze:false});const state=controller.getSnapshot();assert.equal(state.stage,'failed');assert.equal(state.busy,false);assert.equal(state.records.length,0);assert.equal((await storage.list()).length,0);assert.equal(calls,0);assert.equal(state.failureExtraction?.manifest.source,null);assert.equal(state.failureExtraction?.original,f.original);assert.equal(state.failureExtraction?.name,'scan.pdf');controller.dispose();
});
test('a repeat import refreshes extraction while preserving an uncertain accepted job outcome without inference',async()=>{
 const f=await fixture(),storage=createImportStorage({indexedDB:new IDBFactory(),name:'extraction-refresh'});let calls=0;
 await storage.put({id:f.source.id,source:f.source,pipelineVersion:ANALYSIS_PIPELINE_VERSION,stage:'uncertain',error:'Existing submission is unresolved.',updatedAt:1000});
 const controller=new ImportController({storage,extractPdf:async()=>({source:f.source,original:f.original,originalName:'fixture.pdf',extractionEvidence:f.manifest}),importArxiv:async()=>{throw Error('unused');},fetch:async()=>{calls++;throw Error('No inference permitted.');}});controller.activate();await controller.refresh();
 await controller.importPdf(new File([f.original],'fixture.pdf',{type:'application/pdf'}),{analyze:false});const saved=(await storage.get(f.source.id))!;
 assert.equal(saved.stage,'uncertain');assert.equal(saved.error,'Existing submission is unresolved.');assert.equal(saved.extractionEvidence?.manifestSha256,f.manifest.manifestSha256);assert.equal(saved.original?.size,f.original.size);assert.equal(calls,0);assert.equal(controller.getSnapshot().stage,'uncertain');controller.dispose();
});
