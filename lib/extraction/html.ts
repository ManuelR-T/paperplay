import * as cheerio from 'cheerio';
import type {SourceDocument} from '../../shared/schema';
import {EXTRACTION_LIMITS,type ExtractionEvidenceEntry} from '../../shared/extraction-evidence';
import {createExtractionManifest} from './model';
import {sha256} from '../import/normalize';
import {textWithTex} from '../import/html-math';

const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
function inertUrl(raw:string|undefined,base?:string):string|null{
 if(!raw)return null;try{const url=new URL(raw,base);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.href.length<=2000?url.href:null;}catch{return null;}
}
/** Inventory only: strings and links never execute, fetch, or become numeric observations. */
export async function extractHtmlEvidence(html:string,source:SourceDocument,options:{url?:string;originalBytes?:Uint8Array;name?:string}={}){
 const encoded=options.originalBytes??new TextEncoder().encode(html);
 if(encoded.byteLength>2_000_000)throw Error('Structured HTML evidence exceeds the two-million-byte import limit.');
 if(options.originalBytes&&new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(encoded)!==html)throw Error('HTML text differs from its original UTF-8 bytes.');
 const $=cheerio.load(html),url=inertUrl(options.url??source.source.url),declaredBase=$('base[href]').first().attr('href'),base=inertUrl(declaredBase,url??undefined)??url;
 $('script,style,nav,header,footer,form,iframe,object,svg,canvas,.ltx_page_header,.ltx_page_footer').remove();
 const article=$('article.ltx_document').first().length?$('article.ltx_document').first():$('article').first();
 if(!article.length)throw Error('No structured article is available for evidence inventory.');
 const candidates=article.find('h1,h2,h3,h4,h5,h6,p,math,.ltx_equation,.ltx_equationgroup,table,.ltx_table,figure,.ltx_figure,a[href]').toArray();
 const idCounts=new Map<string,number>();$('[id]').each((_,node)=>{const id=$(node).attr('id')!;idCounts.set(id,(idCounts.get(id)??0)+1);});
 const entries:ExtractionEvidenceEntry[]=[],losses=['The HTML inventory is bounded and partial. It does not certify conversion accuracy or recover original PDF coordinates.'];
 if(!options.originalBytes)losses.push('Original-byte identity covers the supplied UTF-8 HTML string; original network encoding bytes were not supplied.');
 let retainedBytes=0,tableCells=0,truncated=false;
 const locator=(node:typeof candidates[number])=>{
  const element=$(node),id=element.attr('id')??null;let cursor=element,path='';
  while(cursor.length&&cursor[0]!==article[0]){const tag=cursor[0].type==='tag'?cursor[0].tagName:'unknown',position=cursor.prevAll(tag).length+1;path=`${tag}:nth-of-type(${position})${path?' > '+path:''}`;cursor=cursor.parent();if(path.length>500){path='';break;}}
  return {kind:'html' as const,url,elementId:id&&id.length<=300?id:null,structuralPath:path||null,ambiguity:id&&(idCounts.get(id)??0)>1?'ambiguous' as const:'unique' as const};
 };
 const blockFor=(text:string,kind?:'equation'|'original-figure')=>{const matches=source.blocks.filter(block=>(!kind||block.kind===kind)&&clean(block.kind==='equation'?block.latex:block.kind==='original-figure'?block.caption:block.text)===clean(text));return matches.length===1?matches[0].id:null;};
 const append=(entry:ExtractionEvidenceEntry)=>{const size=new TextEncoder().encode(JSON.stringify(entry)).byteLength;if(entries.length>=EXTRACTION_LIMITS.entries||retainedBytes+size>900000){truncated=true;return false;}entries.push(entry);retainedBytes+=size;return true;};
 for(const node of candidates){
  if(entries.length>=EXTRACTION_LIMITS.entries){truncated=true;break;}
  const element=$(node),tag=node.tagName.toLowerCase(),rawText=element.text(),at=locator(node),entryLosses:string[]=[];
  const entry=(kind:ExtractionEvidenceEntry['kind'],label:string|null,blockId:string|null=null):ExtractionEvidenceEntry=>({id:`html-e${entries.length+1}`,kind,blockId,label:label?.slice(0,2000)??null,state:'retained',basis:'source-structural-markup',locator:at,losses:entryLosses});
  if(element.hasClass('ltx_equation')||element.hasClass('ltx_equationgroup')){
   if(element.find('math').length)continue;
   const value=entry('equation',clean(rawText)||'Source equation container without retained mathematical markup');value.state='not-extracted';entryLosses.push('Equation container has no supported source MathML/TeX annotation; mathematical content was not reconstructed.');value.payload={kind:'equation',tex:null,mathml:null};append(value);continue;
  }
  if(element.hasClass('ltx_table')&&tag!=='table'){
   if(element.find('table').length)continue;
   const value=entry('table',clean(element.find('figcaption,.ltx_caption').first().text())||'Source table without structured cells');value.state='not-extracted';entryLosses.push('The source table has no supported explicit cell structure; no numeric cells or missing values were guessed.');append(value);continue;
  }
  if(tag==='a'){
   const raw=element.attr('href')??'',hint=[raw,rawText,element.attr('rel')??'',element.attr('class')??''].join(' ');
   if(!/(supplement|ancillary|dataset|source.?data|\bdata\b|\bcode\b|software|github|zenodo|figshare|fairdom)/i.test(hint))continue;
   const target=inertUrl(raw,base??undefined),value=entry('supplement-reference',clean(rawText)||'Source resource reference');
   if(!target){value.state='unavailable';entryLosses.push('Unsafe or unsupported URL was not retained as a navigable link.');}
   value.payload={kind:'supplement-reference',url:target,attachmentName:null,mediaType:element.attr('type')?.slice(0,120)??null,declaredBytes:null,retrievalState:target?'not-requested':'unavailable',reason:target?'Inert source reference; no attachment was requested or inspected. Version, access, bytes and content remain unverified until explicit reviewed retrieval.':'No safe HTTP(S) destination is available. Open the original source or choose a local file.',rights:'Attachment-specific rights are unknown; article access or link presence does not establish redistribution permission.'};
   append(value);continue;
  }
  if(tag==='table'){
   const owner=element.closest('figure,.ltx_table,.ltx_tablewrap'),caption=clean(element.children('caption').first().text()||owner.find('figcaption,.ltx_caption').first().text())||null;
   const value=entry('table',caption??'Structured source table',caption?blockFor(caption):null);
   if(element.find('table').length){value.state='partial';entryLosses.push('Nested table structure is unsupported; no cell grid was guessed.');append(value);continue;}
   const rows:{cells:{text:string;rowSpan:number;colSpan:number;header:boolean}[]}[]=[];let stopped=false,unsupported=false;
   for(const row of element.find('tr').toArray()){
    if(rows.length>=256){stopped=true;break;}const cells=[];
    for(const cell of $(row).children('td,th').toArray()){
     if(cells.length>=32||tableCells>=EXTRACTION_LIMITS.totalTableCells||rows.reduce((sum,r)=>sum+r.cells.length,0)+cells.length>=EXTRACTION_LIMITS.tableCells){stopped=true;break;}
     const current=$(cell),span=(name:string,max:number)=>{const raw=current.attr(name);if(raw===undefined)return 1;if(!/^[1-9]\d*$/.test(raw)||Number(raw)>max)return null;return Number(raw);},rowSpan=span('rowspan',100),colSpan=span('colspan',32);
     if(rowSpan===null||colSpan===null){unsupported=true;break;}
     const text=current.text();if(text.length>500){stopped=true;break;}
     cells.push({text,rowSpan,colSpan,header:cell.tagName.toLowerCase()==='th'});tableCells++;
    }
    if(cells.length)rows.push({cells});if(stopped||unsupported)break;
   }
   if(unsupported){value.state='partial';entryLosses.push('A table span is unsupported or exceeds its reviewed bound; no normalized grid was invented.');}
   else{const notes=owner.find('.ltx_table_note,.ltx_note').toArray();value.payload={kind:'table',rows,caption:caption?.slice(0,2000)??null,footnotes:notes.slice(0,16).map(note=>$(note).text().slice(0,1000))};if(stopped||(caption?.length??0)>2000||notes.length>16||notes.some(note=>$(note).text().length>1000)){value.state='partial';entryLosses.push('Table cell, row, text, caption, footnote or total-inventory bounds were reached; retained cells are a prefix, not a complete numeric table.');}}
   append(value);continue;
  }
  if(tag==='math'){
   const tex=(element.attr('alttext')??element.find('annotation[encoding="application/x-tex"]').first().text())||null,mathml=$.html(node),value=entry('equation',element.closest('.ltx_equation,.ltx_equationgroup').find('.ltx_tag').first().text()||'Source mathematical expression',tex?blockFor(tex,'equation'):null);
   value.payload={kind:'equation',tex:tex&&tex.length<=16384?tex:null,mathml:mathml.length<=16384?mathml:null};
   if(!tex){value.state='partial';entryLosses.push('No source TeX annotation is available; no TeX or missing mathematical symbols were generated.');}if((tex?.length??0)>16384||mathml.length>16384){value.state='partial';entryLosses.push('Mathematical annotation exceeds its retention bound.');}
   append(value);continue;
  }
  if(tag==='figure'||element.hasClass('ltx_figure')){
   if(element.parents('figure,.ltx_figure').length||element.find('table').length)continue;
   const caption=textWithTex($,element.find('figcaption,.ltx_caption').first()),blockId=blockFor(caption,'original-figure'),block=source.blocks.find(value=>value.id===blockId),value=entry('figure',caption||'Source figure without a retained caption',blockId);
   value.state='partial';entryLosses.push('Only caption and approved original image references are inventoried; image bytes/pixels are not retained or checked.');value.payload={kind:'figure',imageUrls:block?.kind==='original-figure'?block.imageUrls??[]:[],pixels:'not-retained'};append(value);continue;
  }
  if(element.parents('table,figure,.ltx_figure').length)continue;
  const blockId=blockFor(rawText),value=entry('text',rawText,blockId);if(!blockId||rawText.length>2000){value.state='partial';entryLosses.push('The inventory label is a bounded excerpt or has no unique exact source-block match; inspect the original source.');}
  if(clean(rawText))append(value);
 }
 if(truncated)losses.push('Evidence entry or retained-byte limits were reached; omitted items were not claimed absent from the source.');
 return createExtractionManifest(source,{sha256:await sha256(encoded),byteLength:encoded.byteLength,mediaType:'text/html',url,name:options.name??null},entries,{extractor:{id:'paperplay-structured-html',version:'1.0.0'},losses,entriesTruncated:truncated,inventory:'partial'});
}
