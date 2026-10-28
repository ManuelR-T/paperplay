import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('offline payload reporting cannot make inference calls or substitute invented measurements for held-out sources',()=>{
 const dir=mkdtempSync(join(tmpdir(),'paperplay-payload-report-')),path=join(dir,'report.json'),script=new URL('../scripts/report-retrieval-payloads.ts',import.meta.url).href;
 try{const code=`let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Network forbidden in offline reporting.');};process.argv[2]=${JSON.stringify(path)};await import(${JSON.stringify(script)});if(calls!==0)throw Error('Offline report attempted a network request.');`;const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',code],{encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stderr);const report=JSON.parse(readFileSync(path,'utf8'));assert.equal(report.cases.length,12);assert.equal(report.inferenceCalls,0);assert.equal(report.actualUsage,null);const heldout=report.cases.filter((c:any)=>c.split==='held-out');assert.equal(heldout.length,4);for(const c of heldout){assert.equal(c.payload,null);assert.equal(c.actualUsage,null);assert.equal(c.status,'deferred-to-frozen-evaluation-PP113');assert.equal(c.planning,undefined);}const development=report.cases.filter((c:any)=>c.split==='development');assert.equal(development.length,8);for(const c of development){assert.ok(c.planning.bytes>=c.planning.characters);assert.ok(c.planning.components.instructionsCharacters>1000);assert.ok(c.planning.components.responseSchemaCharacters>100);assert.ok(c.planning.reservedTokens>c.planning.estimatedInputTokens);assert.equal(c.actualUsage,null);assert.equal(c.inferenceCalls,0);assert.ok(c.unsupportedExactRequirementProbe.blockingGaps.length>0);assert.equal(c.unsupportedExactRequirementProbe.providerCreated,false);}assert.equal(development.filter((c:any)=>c.status==='measured-existing-saved-context').length,3);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
