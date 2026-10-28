import {splitSourceMath,renderSourceMath} from '@/lib/reading/source-math';

/** Source text remains unchanged in storage; only its inline presentation is typeset. */
export function SourceMath({text}:{text:string}){
 const parts=splitSourceMath(text).map(part=>({part,html:part.kind==='math'?renderSourceMath(part.latex):null}));
 return <>{parts.map(({part,html},index)=>{
  if(part.kind==='text')return parts[index-1]?.html?part.raw.replace(/^[,.;:!?]+/u,''):part.raw;
  if(!html)return part.raw;
  const next=parts[index+1]?.part,punctuation=next?.kind==='text'?(next.raw.match(/^[,.;:!?]+/u)?.[0]??''):'';
  return <span key={index} style={{whiteSpace:'nowrap'}}><span data-source-math={part.latex} style={{display:'inline-block',maxWidth:punctuation?'calc(100% - 0.75em)':'100%',verticalAlign:'middle',paddingInline:2,boxSizing:'border-box',overflowX:'auto',overflowY:'hidden'}} dangerouslySetInnerHTML={{__html:html}}/>{punctuation}</span>;
 })}</>;
}
