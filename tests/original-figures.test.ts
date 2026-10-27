import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedPapers } from '../data/papers';
import { originalFigureCrop } from '../lib/reading/original-figures';
import { parseArxivHtml } from '../lib/import/arxiv';

test('reviewed figure regions are bound to exact prepared editions/pages and never guessed for imported versions',()=>{
  let crops=0;
  for(const paper of preparedPapers)for(const block of paper.document.blocks.filter(b=>b.kind==='original-figure')){
    const region=originalFigureCrop(paper.document,block.id);assert.ok(region);crops++;
    assert.ok(region.x>=0&&region.y>=0&&region.width>0&&region.height>0&&region.x+region.width<=1&&region.y+region.height<=1);
    assert.equal(originalFigureCrop({...paper.document,sourceVersion:'different'},block.id),undefined);
    assert.equal(originalFigureCrop({...paper.document,source:{kind:'pdf'}},block.id),undefined);
  }
  assert.equal(crops,4);
});

test('arXiv keeps original figure assets for the exact article and rejects executable or unrelated image locations',async()=>{
  const html=`<base href="https://arxiv.org/html/2501.12345v2/"><article><h1>Test source</h1><p>A complete first paragraph of source text.</p><figure><img src="x1.png" alt="Original mechanism"><img src="/html/2501.12345v2/x2.svg"><img src="https://tracker.invalid/pixel"><img src="javascript:alert(1)"><img src="../other-paper/x.png"><figcaption>Figure 1: Original caption.</figcaption></figure><p>A second source paragraph for normalization.</p></article>`;
  const doc=await parseArxivHtml(html,'2501.12345v2','https://arxiv.org/html/2501.12345v2');
  const figure=doc.blocks.find(b=>b.kind==='original-figure');assert.equal(figure?.kind,'original-figure');
  assert.deepEqual(figure.imageUrls,['https://arxiv.org/html/2501.12345v2/x1.png','https://arxiv.org/html/2501.12345v2/x2.svg']);
  const browserRelative=await parseArxivHtml(html.replace('<base href="https://arxiv.org/html/2501.12345v2/">','').replace('src="x1.png"','src="2501.12345v2/x1.png"'),'2501.12345v2','https://arxiv.org/html/2501.12345v2');
  const first=browserRelative.blocks.find(b=>b.kind==='original-figure');
  assert.equal(first?.imageUrls?.[0],'https://arxiv.org/html/2501.12345v2/x1.png');
  assert.equal(figure.alt,'Original mechanism');assert.equal(figure.caption,'Figure 1: Original caption.');
  assert.ok(!JSON.stringify(doc).includes('tracker.invalid'));assert.ok(!JSON.stringify(doc).includes('javascript:'));
});
