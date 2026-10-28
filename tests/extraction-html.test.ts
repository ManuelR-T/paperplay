import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArxivHtml,parseArxivHtmlEvidenced,resolveArxiv} from '../lib/import/arxiv';
import {extractHtmlEvidence} from '../lib/extraction/html';
import {validateExtractionEvidenceManifest} from '../lib/extraction/model';
import {sha256} from '../lib/import/normalize';

const url='https://arxiv.org/html/1706.03762v7';
const html=`<!doctype html><html><head><base href="${url}/"><meta name="citation_title" content="Authored structural evidence fixture"><meta name="citation_author" content="Paperplay"></head><body><article class="ltx_document"><h1 id="title">Authored structural evidence fixture</h1><p id="intro">These project-authored values test extraction mechanics, not empirical observations or a scientific result.</p><div class="ltx_equation"><math id="equation" alttext="x^2=4"><msup><mi>x</mi><mn>2</mn></msup><mo>=</mo><mn>4</mn></math><span class="ltx_tag">(1)</span></div><p>Another source paragraph includes a mathematical expression <math><mi>α</mi><mo>+</mo><mi>β</mi></math>, with no source TeX annotation.</p><table id="table"><caption>Table 1. Authored strings and missing cells</caption><thead><tr><th rowspan="2">Sample</th><th colspan="2">M ± SE</th></tr><tr><th>Value</th><th>SE</th></tr></thead><tbody><tr><td>001</td><td></td><td>not reported</td></tr><tr><td>002</td><td>1.20</td><td>0.03</td></tr></tbody></table><figure id="fig"><img src="x1.png"><figcaption>Figure 1. Original source caption only.</figcaption></figure><p>References: <a id="resource" href="https://fairdomhub.org/data_files/2212?version=1">Source dataset</a> and <a id="resource" href="https://fairdomhub.org/data_files/2212?version=1">Dataset duplicate</a>. <a href="javascript:steal()">Supplement unsafe</a>. <a href="https://example.org/supplement.pdf">Supplement PDF</a>.</p><script>steal()</script></article></body></html>`;

test('HTML evidence retains source TeX and table strings/spans/blanks without creating numeric observations',async()=>{
 const evidenced=await parseArxivHtmlEvidenced(html,'1706.03762v7',url),legacy=await parseArxivHtml(html,'1706.03762v7',url);
 assert.deepEqual(evidenced.source,legacy);assert.equal(evidenced.source.pageCount,1);
 const manifest=await validateExtractionEvidenceManifest(evidenced.extractionEvidence,evidenced.source);
 const table=manifest.entries.find(entry=>entry.kind==='table')!;assert.equal(table.state,'retained');if(table.payload?.kind!=='table')throw Error();
 assert.deepEqual(table.payload.rows[0].cells,[{text:'Sample',rowSpan:2,colSpan:1,header:true},{text:'M ± SE',rowSpan:1,colSpan:2,header:true}]);
 assert.deepEqual(table.payload.rows[2].cells.map(cell=>cell.text),['001','','not reported']);
 assert.equal(table.payload.rows[3].cells[1].text,'1.20');assert.ok(!('values'in table.payload));
 const equations=manifest.entries.filter(entry=>entry.kind==='equation');assert.equal(equations.length,2);
 assert.equal(equations[0].payload?.kind,'equation');if(equations[0].payload?.kind!=='equation'||equations[1].payload?.kind!=='equation')throw Error();
 assert.equal(equations[0].payload.tex,'x^2=4');assert.equal(equations[1].payload.tex,null);assert.ok(equations[1].payload.mathml?.includes('α'));
 assert.equal(equations[1].state,'partial');assert.ok(equations[1].losses.some(loss=>loss.includes('no TeX')));
 assert.ok(manifest.entries.every(entry=>entry.locator.kind==='html'));
});

test('source figures retain references only; duplicate HTML identities stay ambiguous and unsafe links are inert',async()=>{
 const {extractionEvidence:manifest}=await parseArxivHtmlEvidenced(html,'1706.03762v7',url);
 const figure=manifest.entries.find(entry=>entry.kind==='figure')!;assert.equal(figure.state,'partial');if(figure.payload?.kind!=='figure')throw Error();
 assert.equal(figure.payload.pixels,'not-retained');assert.deepEqual(figure.payload.imageUrls,[url+'/x1.png']);
 const links=manifest.entries.filter(entry=>entry.kind==='supplement-reference');assert.equal(links.length,4);
 const duplicates=links.filter(entry=>entry.locator.kind==='html'&&entry.locator.elementId==='resource');assert.equal(duplicates.length,2);
 assert.ok(duplicates.every(entry=>entry.locator.kind==='html'&&entry.locator.ambiguity==='ambiguous'));
 assert.equal(new Set(duplicates.map(entry=>entry.locator.kind==='html'?entry.locator.structuralPath:null)).size,2);
 const unsafe=links.find(entry=>entry.label==='Supplement unsafe')!;assert.equal(unsafe.state,'unavailable');if(unsafe.payload?.kind!=='supplement-reference')throw Error();assert.equal(unsafe.payload.url,null);
 assert.ok(!JSON.stringify(manifest).includes('javascript:'));assert.ok(links.every(entry=>entry.payload?.kind==='supplement-reference'&&['not-requested','unavailable'].includes(entry.payload.retrievalState)));
});

test('HTML byte identity includes the supplied UTF-8 BOM and never claims synthetic PDF coordinates',async()=>{
 const input='\uFEFF'+html,originalBytes=new TextEncoder().encode(input),{source,extractionEvidence}=await parseArxivHtmlEvidenced(input,'1706.03762v7',url,{originalBytes});
 assert.equal(extractionEvidence.original.sha256,await sha256(originalBytes));assert.equal(extractionEvidence.original.byteLength,originalBytes.byteLength);
 assert.ok(!extractionEvidence.losses.some(loss=>loss.includes('network encoding')));
 assert.ok(extractionEvidence.entries.every(entry=>entry.locator.kind!=='pdf'));assert.equal(source.pageCount,1);
 await assert.rejects(()=>extractHtmlEvidence(html,source,{url,originalBytes:new TextEncoder().encode(html+'changed')}),/differs/);
 await assert.rejects(()=>extractHtmlEvidence(html,source,{url,originalBytes:new Uint8Array([0xff])}));
});

test('unsupported table spans and bounded large tables report loss rather than inventing normalized cells',async()=>{
 const unsupported=html.replace('rowspan="2"','rowspan="0"'),parsed=await parseArxivHtmlEvidenced(unsupported,'1706.03762v7',url);
 const entry=parsed.extractionEvidence.entries.find(entry=>entry.kind==='table')!;assert.equal(entry.state,'partial');assert.equal(entry.payload,undefined);assert.ok(entry.losses.some(loss=>loss.includes('span')));
 const large=html.replace('<td>001</td>','<td>'+('a'.repeat(501))+'</td>'),bounded=await parseArxivHtmlEvidenced(large,'1706.03762v7',url);
 const table=bounded.extractionEvidence.entries.find(entry=>entry.kind==='table')!;assert.equal(table.state,'partial');assert.ok(table.losses.some(loss=>loss.includes('bounds')));
});

test('inventory construction has no outbound calls and changed table content changes evidence identity',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error();};
 try{
  const first=await parseArxivHtmlEvidenced(html,'1706.03762v7',url),second=await parseArxivHtmlEvidenced(html.replace('1.20','1.21'),'1706.03762v7',url);
  assert.equal(calls,0);assert.notEqual(first.extractionEvidence.original.sha256,second.extractionEvidence.original.sha256);assert.notEqual(first.extractionEvidence.manifestSha256,second.extractionEvidence.manifestSha256);
 }finally{globalThis.fetch=original;}
});

test('the arXiv HTML transport supplies actual original bytes to its evidence manifest',async()=>{
 const text='\uFEFF'+html,bytes=new TextEncoder().encode(text);let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return new Response(bytes,{headers:{'Content-Type':'text/html'}});};
 const result=await resolveArxiv('1706.03762v7',{fetcher});assert.equal(result.kind,'html');if(result.kind!=='html')throw Error();
 assert.equal(calls,1);assert.equal(result.extractionEvidence?.original.sha256,await sha256(bytes));assert.equal(result.extractionEvidence?.original.byteLength,bytes.byteLength);
});

test('unsupported equation and graphical-table containers are inventoried as losses',async()=>{
 const input=html.replace('</article>','<div class="ltx_equation">Equation image unavailable</div><figure class="ltx_table"><figcaption>Table 2. Graphical table only</figcaption></figure></article>');
 const {extractionEvidence}=await parseArxivHtmlEvidenced(input,'1706.03762v7',url);
 const equation=extractionEvidence.entries.find(entry=>entry.kind==='equation'&&entry.state==='not-extracted')!;
 assert.ok(equation.losses.some(loss=>loss.includes('not reconstructed')));if(equation.payload?.kind!=='equation')throw Error();assert.equal(equation.payload.tex,null);
 const table=extractionEvidence.entries.find(entry=>entry.kind==='table'&&entry.state==='not-extracted')!;assert.equal(table.payload,undefined);assert.ok(table.losses.some(loss=>loss.includes('no numeric cells')));
});
