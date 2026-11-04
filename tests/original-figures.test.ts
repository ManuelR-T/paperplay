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

test('arXiv figure captions keep each formula once, as TeX, and stay linked in the evidence inventory',async()=>{
  // LaTeXML MathML: rendered glyphs plus a TeX annotation inside the same <math> element.
  const math=(glyphs:string,tex:string)=>`<math alttext="${tex}" display="inline"><semantics><mrow><mi>${glyphs}</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math>`;
  const html=`<base href="https://arxiv.org/html/2610.00001v1/"><article class="ltx_document"><h1>Test source</h1><p>A complete first paragraph of source text.</p><figure class="ltx_figure"><img src="x1.png" alt="Protocol"><figcaption class="ltx_caption">Figure 1: Alice holds ${math('BA','B_{A}')} and the pair ${math('|Φ⟩','\\ket{\\Phi}_{B_{A}B_{C}}')} is shared.</figcaption></figure><p>A second source paragraph for normalization.</p></article>`;
  const doc=await parseArxivHtml(html,'2610.00001v1','https://arxiv.org/html/2610.00001v1');
  const figure=doc.blocks.find(b=>b.kind==='original-figure');assert.equal(figure?.kind,'original-figure');
  assert.equal(figure.caption,'Figure 1: Alice holds \\(B_{A}\\) and the pair \\(\\ket{\\Phi}_{B_{A}B_{C}}\\) is shared.');
  const {extractHtmlEvidence}=await import('../lib/extraction/html');
  const evidence=await extractHtmlEvidence(html,doc,{url:'https://arxiv.org/html/2610.00001v1'});
  assert.ok(evidence.entries.some(entry=>entry.kind==='figure'&&entry.blockId===figure.id),'the caption still matches its source block');
});

test('arXiv retains ordinary relative image paths without a base tag',async()=>{
  const html='<article><h1>Source</h1><p>First source paragraph with enough text.</p><figure><img src="x1.png"><figcaption>Figure 1: A mechanism.</figcaption></figure><p>Second source paragraph with enough text.</p></article>';
  const doc=await parseArxivHtml(html,'2501.12345v2','https://arxiv.org/html/2501.12345v2');
  assert.deepEqual(doc.blocks.find(b=>b.kind==='original-figure')?.imageUrls,['https://arxiv.org/html/2501.12345v2/x1.png']);
});

test('source tables retain real cells and spans instead of becoming missing-image figures',async()=>{
  const html='<article><h1>Source</h1><p>First source paragraph.</p><figure class="ltx_table"><figcaption>Table 2: Tool access improves instruction following.</figcaption><table><tr><th rowspan="2">Task</th><th colspan="2">Compliance</th></tr><tr><th>Strict</th><th>Partial</th></tr><tr><td>Tools</td><td>90%</td><td>95%</td></tr></table></figure><p>Second source paragraph.</p></article>';
  const doc=await parseArxivHtml(html,'2501.12345v2','https://arxiv.org/html/2501.12345v2');
  const table=doc.blocks.find(b=>b.kind==='original-figure');
  assert.equal(table?.table?.rows[0].cells[0].rowSpan,2);
  assert.equal(table?.table?.rows[0].cells[1].colSpan,2);
  assert.equal(table?.table?.rows[2].cells[1].text,'90%');
});

test('the reader displays original table cells rather than the missing-image notice',async()=>{
  const {createElement}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {OriginalSourceFigure}=await import('../components/reading/original-source-figure');
  const source=await parseArxivHtml('<article><h1>Source</h1><p>First paragraph.</p><figure><figcaption>Table 2: Compliance</figcaption><table><tr><th>Tools</th><td>90%</td></tr></table></figure><p>Second paragraph.</p></article>','2501.12345v2','https://arxiv.org/html/2501.12345v2');
  const block=source.blocks.find(b=>b.kind==='original-figure')!;
  const html=renderToStaticMarkup(createElement(OriginalSourceFigure,{source,block,htmlSource:true}));
  assert.match(html,/<table/);assert.match(html,/<th/);assert.match(html,/90%/);
  assert.doesNotMatch(html,/inline preview is unavailable|could not be recovered/);
});

test('arXiv SVG object graphics are retained as inert image URLs, including Figure 5 in 2611.00558v1',async()=>{
  const html='<article><h1>Source</h1><p>First source paragraph.</p><figure><object type="image/svg+xml" data="2611.00558v1/blackbox_std.svg" class="ltx_graphics"></object><object type="text/html" data="2611.00558v1/unsafe.html"></object><object type="image/svg+xml" data="https://tracker.invalid/chart.svg"></object><figcaption>Figure 5: Black-box setting.</figcaption></figure><p>Second source paragraph.</p></article>';
  const source=await parseArxivHtml(html,'2611.00558v1','https://arxiv.org/html/2611.00558v1');
  const figure=source.blocks.find(block=>block.kind==='original-figure')!;
  assert.deepEqual(figure.imageUrls,['https://arxiv.org/html/2611.00558v1/blackbox_std.svg']);
  const {createElement}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {OriginalSourceFigure}=await import('../components/reading/original-source-figure');
  const rendered=renderToStaticMarkup(createElement(OriginalSourceFigure,{source,block:figure,htmlSource:true}));
  assert.match(rendered,/<img[^>]+blackbox_std\.svg/);
  assert.doesNotMatch(rendered,/<object|<iframe|unsafe\.html|tracker\.invalid/);
});

test('original figure recovery is independent of long-document text admission and retains inline SVG safely',async()=>{
 const {parseArxivOriginalFigures}=await import('../lib/import/arxiv');
 const html='<article><h1>Long source</h1><p>'+('source text '.repeat(21000))+'</p><figure id="f2"><svg viewBox="0 0 100 80"><script>alert(1)</script><path d="M0 0L10 10" onclick="alert(1)"/><foreignObject><span>51.28</span></foreignObject><image href="https://tracker.invalid/x"/></svg><figcaption>Figure 2: Original chart.</figcaption></figure></article>';
 const figures=parseArxivOriginalFigures(html,'2610.37658v1','https://arxiv.org/html/2610.37658v1');
 assert.equal(figures.length,1);
 const figure=figures[0];assert.equal(figure.kind,'original-figure');
 assert.match(figure.inlineSvg!,/51.28/);assert.match(figure.inlineSvg!,/viewBox/);
 assert.doesNotMatch(figure.inlineSvg!,/script|onclick|tracker.invalid/);
});
