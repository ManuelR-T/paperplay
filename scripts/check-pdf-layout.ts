import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { NORMALIZER_VERSION, paragraphBlocks, pdfBlocksFromText, pdfItemsToText, pdfItemsToTextLegacy, type PdfTextItem } from '../lib/import/normalize';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const files=process.argv.slice(2);
if(!files.length)throw Error('Pass paths to fixed PDF corpus files. This script does not download or publish source content.');
const reports=[];
const characters=(text:string)=>[...text.replace(/\s|\u0000/g,'')].sort().join('');
for(const file of files){
 const bytes=await readFile(file); const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const pdf=await task.promise;
 const pages=[];
 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
  const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();const items=content.items.filter((item):item is typeof item&PdfTextItem=>'str'in item);
  const before=pdfItemsToTextLegacy(items,page.getViewport({scale:1}).width);const after=pdfItemsToText(items,page.getViewport({scale:1}).width);
  const inputText=items.map(item=>item.str).join('');
  const beforeBlocks=paragraphBlocks(before.text,pageNumber);const afterBlocks=pdfBlocksFromText(after.text,pageNumber);
  pages.push({page:pageNumber,layout:after.layout,reordered:after.columnsReordered,nonWhitespaceCharactersRetained:characters(after.text)===characters(inputText),unchangedText:before.text===after.text,
   oldCaptionReferences:beforeBlocks.filter(block=>block.kind==='original-figure').length,newCaptionReferences:afterBlocks.filter(block=>block.kind==='original-figure').length});
  page.cleanup();
 }
 reports.push({file:basename(file),sha256:createHash('sha256').update(bytes).digest('hex'),pageCount:pdf.numPages,reorderedPages:pages.filter(page=>page.reordered).length,
  retainedCharacterPages:pages.filter(page=>page.nonWhitespaceCharactersRetained).length,unchangedTextPages:pages.filter(page=>page.unchangedText).length,
  oldCaptionReferences:pages.reduce((sum,page)=>sum+page.oldCaptionReferences,0),newCaptionReferences:pages.reduce((sum,page)=>sum+page.newCaptionReferences,0),pages});
 await task.destroy();
}
console.log(JSON.stringify({normalizer:NORMALIZER_VERSION,reports,note:'Geometry confidence, exact non-whitespace character retention and caption-reference counts are measured. They do not certify mathematical or semantic reading order. Full source/PDF bodies are not included.'},null,2));
