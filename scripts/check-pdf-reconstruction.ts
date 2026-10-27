/** Local fixed-corpus source-quality check; original PDFs are not copied into reports. */
import {readFile,writeFile}from'node:fs/promises';
import{extractPdfWithLibrary}from'../lib/import/pdf-core';
import{pdfItemsToText,pdfBlocksFromText,cleanText}from'../lib/import/normalize';
import{reconstructPdfText}from'../lib/import/reconstruct';
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const files=process.argv.slice(2).length?process.argv.slice(2):['public/papers/priority-search-trees.pdf','public/papers/adaptive-mergesort.pdf'];
const results=[];
for(const file of files){
 const bytes=await readFile(file);const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const pdf=await task.promise;
 let beforeHeadings=0,afterHeadings=0,rawCharacters=0,retainedRaw=0,hyphenatedBefore=0,hyphenatedAfter=0,regionCount=0,joinedParagraphs=0;const pages=[];
 for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);const content=await p.getTextContent();const layout=pdfItemsToText(content.items.filter((x):x is typeof x&{str:string;transform:number[]}=>'str'in x),p.getViewport({scale:1}).width);pages.push({page:n,text:layout.text,regions:layout.regions});p.cleanup();}
 const witness=pages.map(p=>p.text).join('\n');
 for(const p of pages){const old=pdfBlocksFromText(p.text,p.page);const regions=p.regions.slice(0,500).map((l,i)=>({id:`p${p.page}-r${i}`,text:l.text.slice(0,5000),x:l.x,y:l.y,width:Math.max(0,l.right-l.x),height:l.height}));const next=reconstructPdfText(p.text,p.page,regions,witness);
 beforeHeadings+=old.filter(b=>b.kind==='heading').length;afterHeadings+=next.filter(b=>b.kind==='heading').length;rawCharacters+=p.text.replace(/\s/g,'').length;retainedRaw+=next.map(b=>b.reconstruction?.rawText??'').join('').replace(/\s/g,'').length;
 hyphenatedBefore+=(p.text.match(/[a-z]{2,}-\s*\n\s*[a-z]{2,}/g)??[]).length;hyphenatedAfter+=next.reduce((n,b)=>n+((('text'in b?b.text:b.kind==='equation'?b.latex:b.caption).match(/[a-z]{2,}-\s+[a-z]{2,}/g)??[]).length),0);joinedParagraphs+=next.filter(b=>b.reconstruction?.operations.includes('join-lines')).length;regionCount+=regions.length;
 }
 const actual=await extractPdfWithLibrary(new Blob([bytes]),{name:file.split('/').at(-1)},pdfjs);
 results.push({sourceFile:file.split('/').at(-1),physicalPages:pdf.numPages,beforeHeadings,afterHeadings,rawNonWhitespaceCharacters:rawCharacters,retainedRawNonWhitespaceCharacters:retainedRaw,allRawCharactersRetained:rawCharacters===retainedRaw,lineEndHyphensBefore:hyphenatedBefore,spacedHyphensAfter:hyphenatedAfter,joinedParagraphs,recordedRegions:regionCount,newSourceVersion:actual.source.sourceVersion,blocks:actual.source.blocks.length,requestBytes:new TextEncoder().encode(JSON.stringify(actual.source)).length,limitations:['Heading detection and joins remain heuristic.','Non-witnessed hyphenation is deliberately retained.','No image, table or equation transcription is invented.','Coordinate regions are page-space mappings, not proof of semantic correctness.']});
 await task.destroy();
}
const report={checkedAt:new Date().toISOString(),kind:'developer extraction review, not participant study',normalizer:'source-v3',results};
await writeFile('docs/pdf-reconstruction-v3.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(results.some(r=>!r.allRawCharactersRetained))process.exitCode=1;
