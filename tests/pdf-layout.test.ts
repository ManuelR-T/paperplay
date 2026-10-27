import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NORMALIZER_VERSION, normalizeSource, pdfBlocksFromText, pdfItemsToText, pdfItemsToTextLegacy, type PdfTextItem } from '../lib/import/normalize';
import { extractPdfWithLibrary } from '../lib/import/pdf-core';
function item(str:string,x:number,y:number,width=200):PdfTextItem { return {str,transform:[10,0,0,10,x,y],width,height:10,hasEOL:true}; }
function inversionCount(text:string,expected:string[]) {
  let count=0;for(let i=0;i<expected.length;i++)for(let j=i+1;j<expected.length;j++)if(text.indexOf(expected[i])>text.indexOf(expected[j]))count++;
  return count;
}

test('fixed two-column PDF geometry removes interleaving while retaining every source character and full-width headings', () => {
  const items:PdfTextItem[]=[item('Section title',40,760,500)];
  for(let i=0;i<12;i++)items.push(item(`LEFT${String(i).padStart(2,'0')} column source prose has readable words.`,40,730-i*14),item(`RIGHT${String(i).padStart(2,'0')} column source prose has readable words.`,330,730-i*14));
  items.push(item('Figure 1: Original caption retained exactly.',40,510,500));
  const before=pdfItemsToTextLegacy(items,600);const after=pdfItemsToText(items,600);
  const expected=[...Array.from({length:12},(_,i)=>`LEFT${String(i).padStart(2,'0')} column source prose has readable words.`),...Array.from({length:12},(_,i)=>`RIGHT${String(i).padStart(2,'0')} column source prose has readable words.`)];
  assert.equal(inversionCount(before.text,expected),66);assert.equal(inversionCount(after.text,expected),0);
  assert.equal(after.columnsReordered,true);assert.equal(after.layout,'two-column');
  assert.ok(after.text.indexOf('Section title')<after.text.indexOf('LEFT00'));
  assert.ok(after.text.indexOf('RIGHT11')<after.text.indexOf('Figure 1:'));
  const letters=(text:string)=>[...text.replace(/\s/g,'')].sort().join('');
  assert.equal(letters(after.text),letters(items.map(x=>x.str).join('')));
});

test('single-column text and uncertain column evidence preserve content without manufacturing equations or figure images', () => {
  const full=Array.from({length:12},(_,i)=>item(`A full source line ${i} contains mathematical ∑ x notation.`,40,700-i*14,510));
  const after=pdfItemsToText(full,600);assert.equal(after.columnsReordered,false);assert.equal(after.layout,'single-column');
  const blocks=pdfBlocksFromText(after.text+'\n\nFigure 2: Caption from the original source page.',3);
  assert.equal(blocks.filter(block=>block.kind==='equation').length,0);
  const caption=blocks.find(block=>block.kind==='original-figure');assert.ok(caption);assert.equal(caption.page,3);assert.match(caption.alt,/not been reconstructed/);
  const sparse=Array.from({length:14},(_,i)=>item(`Ambiguous ${i}`,i%2?340:30,700-i*12));
  assert.equal(pdfItemsToText(sparse,600).text.includes('Ambiguous 13'),true);
});

test('new layout identities explicitly invalidate source-v1 analyses and preserve physical-page caption anchors', async () => {
  assert.equal(NORMALIZER_VERSION,'source-v2');
  const doc=await normalizeSource({kind:'pdf',title:'Layout fixture',pageCount:3,blocks:pdfBlocksFromText('Figure 2: Original caption with physical provenance.\n\nA source statement about an unchanged mechanism.',3),identity:'fixture'});
  assert.match(doc.sourceVersion,/^source-v2:/);assert.equal(doc.anchors[0].page,3);assert.equal(doc.blocks[0].kind,'original-figure');
  assert.equal(doc.anchors[0].quote,'Figure 2: Original caption with physical provenance.');
});

test('actual single-column publisher control remains page-linked and nonempty after geometry repair',async()=>{
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const bytes=await readFile('public/papers/priority-search-trees.pdf');
  const result=await extractPdfWithLibrary(new Blob([bytes]),{name:'control.pdf'},pdfjs);
  assert.equal(result.source.pageCount,18);assert.ok(result.source.blocks.length>100);assert.match(result.source.sourceVersion,/^source-v2:/);
  assert.ok(result.source.blocks.some(block=>block.page===15));
  assert.ok(result.source.extractionWarnings.some(warning=>warning.includes('equation')));
});
