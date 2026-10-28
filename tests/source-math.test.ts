import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SourceMath} from '../components/reading/source-math';
import {splitSourceMath,renderSourceMath} from '../lib/reading/source-math';
import {parseArxivHtml} from '../lib/import/arxiv';
import {validateDocument} from '../shared/schema';

const example=String.raw`In an m-edge n-vertex directed graph G=(V,E) with a non-negative weight function w:E\to\mathbb{R}_{\geq 0}, single-source shortest path (SSSP) considers the lengths of the shortest paths from a source vertex s to all v\in V. Designing faster algorithms for SSSP is one of the most fundamental problems in graph theory, with exciting improvements since the 50s.`;

test('cached raw inline LaTeX is typeset without consuming prose or changing exact source strings',()=>{
 const parts=splitSourceMath(example),math=parts.filter(part=>part.kind==='math');
 assert.deepEqual(math.map(part=>part.latex),[String.raw`w:E\to\mathbb{R}_{\geq 0}`,String.raw`v\in V`]);
 assert.equal(parts.map(part=>part.raw).join(''),example);
 const html=renderToStaticMarkup(createElement(SourceMath,{text:example}));
 assert.equal((html.match(/data-source-math=/g)??[]).length,2);
 assert.match(html,/mathvariant="double-struck"/);assert.match(html,/→/);assert.match(html,/≥/);assert.match(html,/∈/);
 assert.match(html,/Designing faster algorithms for SSSP/);assert.match(html,/exciting improvements since the 50s/);
});

test('explicit delimiters support symbols and formulas while currency and code remain plain text',()=>{
 const text=String.raw`Let \(G=(V,E)\) and $x^2+1$ be models. Costs are $5 and $10, escaped \$2, code `+'`'+String.raw`w:E\to R`+'`.';
 const parts=splitSourceMath(text);
 assert.deepEqual(parts.filter(part=>part.kind==='math').map(part=>part.latex),['G=(V,E)','x^2+1']);
 assert.equal(parts.map(part=>part.raw).join(''),text);
 const html=renderToStaticMarkup(createElement(SourceMath,{text}));assert.match(html,/Costs are \$5 and \$10/);assert.match(html,/code `w:E\\to R`/);
});

test('untrusted or unsupported math cannot create links/HTML or hide the original text',()=>{
 const malicious=String.raw`Before \(\notARealSourceCommand{<img src=x onerror=alert(1)>}\) after.`;
 const html=renderToStaticMarkup(createElement(SourceMath,{text:malicious}));
 assert.match(html,/Before/);assert.match(html,/notARealSourceCommand/);assert.equal(html.includes('<img'),false);assert.match(html,/after\./);
 const link=renderSourceMath(String.raw`\href{javascript:alert(1)}{click}`);
 assert.equal(/<a(?:\s|>)/.test(link??''),false);assert.equal(link?.includes('href="javascript:'),false);
 assert.equal(renderSourceMath('x'.repeat(1501)),null);
});

test('new arXiv extraction retains real inline math boundaries and exact source anchors for rendering',async()=>{
 const html=String.raw`<article class="ltx_document"><h1>Shortest paths</h1><p>Consider a weight function <math alttext="w:E\to\mathbb{R}_{\geq 0}"><mi>w</mi></math> and the graph.</p><p>A path reaches <math><semantics><mi>v</mi><annotation encoding="application/x-tex">v\in V</annotation></semantics></math> in this source.</p></article>`;
 const source=await parseArxivHtml(html,'1805.04154v1','https://arxiv.org/html/1805.04154v1');validateDocument(source);
 const paragraphs=source.blocks.filter(block=>block.kind==='paragraph');
 assert.equal(paragraphs[0].text,String.raw`Consider a weight function \(w:E\to\mathbb{R}_{\geq 0}\) and the graph.`);
 assert.equal(paragraphs[1].text,String.raw`A path reaches \(v\in V\) in this source.`);
 const original=JSON.stringify(source);
 for(const block of paragraphs){renderToStaticMarkup(createElement(SourceMath,{text:block.text}));for(const anchor of source.anchors.filter(anchor=>anchor.blockId===block.id))assert.ok(block.text.includes(anchor.quote));}
 assert.equal(JSON.stringify(source),original);
});
