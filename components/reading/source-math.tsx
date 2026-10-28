import {splitSourceMath,renderSourceMath} from '@/lib/reading/source-math';

/** Source text remains unchanged in storage; only its inline presentation is typeset. */
export function SourceMath({text}:{text:string}){
 return <>{splitSourceMath(text).map((part,index)=>{
  if(part.kind==='text')return part.raw;
  const html=renderSourceMath(part.latex);
  return html?<span key={index} data-source-math={part.latex} style={{display:'inline-block',maxWidth:'100%',verticalAlign:'middle',paddingInline:2,boxSizing:'border-box',overflowX:'auto',overflowY:'hidden'}} dangerouslySetInnerHTML={{__html:html}}/>:part.raw;
 })}</>;
}
