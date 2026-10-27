import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { type HostedEnvironment } from '../deploy/worker';
import { analysisSource } from './analysis-fixtures';
const origin='https://paperplay.example';
function env(overrides:Partial<HostedEnvironment>={}):HostedEnvironment {
  return { ASSETS:{async fetch(){return new Response('Prepared static reader',{headers:{'Content-Type':'text/html'}})}},ANALYSIS_APP_ORIGIN:origin,...overrides };
}
function post(path:string,body:unknown){return new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});}

test('hosted router serves the same static reader and public configuration without requiring a quota database',async()=>{
  const response=await worker.fetch(new Request(origin+'/'),env());assert.equal(await response.text(),'Prepared static reader');
  const health=await worker.fetch(new Request(origin+'/api/health'),env());const body=await health.json();
  assert.equal(body.meta.configured,false);assert.equal(body.hosting.quotaStore,'unavailable');assert.equal(body.hosting.runtime,'cloudflare-worker');
  assert.equal((await worker.fetch(new Request(origin+'/api/unknown'),env())).status,404);
});

test('hosted paid routes fail closed without D1 and configured cutoff blocks creation before database work',async()=>{
  const source=analysisSource();
  const inputs=[['/api/analysis/start',{source,requestId:'hosted-analysis-fixture-001'}],['/api/questions',{context:{source,blockId:'method'},question:'Explain this method.',requestId:'hosted-question-fixture-001'}]] as const;
  for(const [path,body] of inputs){
    assert.equal((await worker.fetch(post(path,body),env({MODEL_API_KEY:'fixture-not-real'}))).status,503);
    let queries=0;
    const disabled=env({MODEL_API_KEY:'fixture-not-real',META_ANALYSIS_ENABLED:'false',DB:{prepare(){queries++;throw Error('Database must not be touched for disabled inference.');}}});
    const response=await worker.fetch(post(path,body),disabled);assert.equal(response.status,503);assert.equal(queries,0);
    assert.equal((await response.text()).includes('fixture-not-real'),false);
  }
});

test('hosted arXiv route retains identifier validation and never becomes an arbitrary URL proxy',async()=>{
  const response=await worker.fetch(new Request(origin+'/api/arxiv?id='+encodeURIComponent('https://untrusted.example/abs/1805.04154')),env());
  assert.equal(response.status,400);
});

test('hosted accepted-job routes retain ownership validation when quota storage is unavailable',async()=>{
  const source=analysisSource();
  const job={token:'invalid-session-reference',model:'muse-spark-1.3',sourceId:source.id,sourceVersion:source.sourceVersion,createdAt:1};
  for(const path of ['/api/analysis/status','/api/analysis/cancel']){
    const response=await worker.fetch(post(path,{source,job}),env({MODEL_API_KEY:'fixture-not-real'}));
    assert.equal(response.status,403,'ownership is checked rather than hiding recovery behind the missing quota store');
  }
});
