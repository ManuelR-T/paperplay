import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverOriginalImages} from '../lib/reading/recover-original-images';

test('saved edition images recover by caption with one shared request and no analysis',async()=>{
  let calls=0;
  const fetcher=(async(url:string)=>{calls++;assert.equal(url,'/api/arxiv/figures?id=2501.12346v2');return Response.json({kind:'html',arxivId:'2501.12346v2',figures:[{kind:'original-figure',caption:'Figure 1: Mechanism',imageUrls:['https://arxiv.org/html/2501.12346v2/x1.png']}]});}) as typeof fetch;
  const results=await Promise.all([recoverOriginalImages('https://arxiv.org/html/2501.12346v2','Figure 1: Mechanism',fetcher),recoverOriginalImages('https://arxiv.org/html/2501.12346v2','Missing caption',fetcher)]);
  assert.equal(calls,1);assert.equal(results[0].length,1);assert.deepEqual(results[1],[]);
});
test('unpinned editions never recover figures from a potentially different revision',async()=>{
  assert.deepEqual(await recoverOriginalImages('https://arxiv.org/html/2501.12346','Caption',(()=>{throw Error('must not fetch');}) as typeof fetch),[]);
});

test('saved caption-only tables recover real cell data from the pinned article',async()=>{
  const {recoverOriginalFigure}=await import('../lib/reading/recover-original-images');
  const table={rows:[{cells:[{text:'90%',header:false,rowSpan:1,colSpan:1}]}]};
  const fetcher=(async()=>Response.json({kind:'html',arxivId:'2501.12347v2',figures:[{kind:'original-figure',caption:'Table 2: Compliance',table}]})) as typeof fetch;
  const recovered=await recoverOriginalFigure('https://arxiv.org/html/2501.12347v2','Table 2: Compliance',fetcher);
  assert.deepEqual(recovered?.table,table);
});
