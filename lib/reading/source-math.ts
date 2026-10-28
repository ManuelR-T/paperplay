import katex from 'katex';

export type SourceMathPart = {kind:'text';raw:string}|{kind:'math';raw:string;latex:string};
const MAX_INLINE_MATH = 1500;
const needsRightAtom = new Set(['to','rightarrow','leftarrow','leftrightarrow','mapsto','in','notin','subset','subseteq','supset','supseteq','le','leq','ge','geq','neq','ne','approx','sim','equiv','times','cdot','cup','cap','setminus','log','ln','sin','cos','tan','exp','lim','sum','prod','sqrt']);
function escaped(text:string,index:number){let slashes=0;while(index>0&&text[--index]==='\\')slashes++;return slashes%2===1;}
function groupEnd(text:string,start:number){const open=text[start],close=open==='{'?'}':']';let depth=0;for(let i=start;i<text.length&&i-start<=MAX_INLINE_MATH;i++){if(escaped(text,i))continue;if(text[i]===open)depth++;if(text[i]===close&&--depth===0)return i+1;}return start;}

/** Old imports lost math boundaries. Recover only command-bearing expressions, never whole prose paragraphs. */
function rawMathEnd(text:string,commandStart:number){
 let at=commandStart,needsAtom=false,parenDepth=0;
 while(at<text.length&&at-commandStart<MAX_INLINE_MATH){
  const char=text[at];
  if(char==='\\'){
   const command=/^\\([A-Za-z]+|[{}|])/u.exec(text.slice(at));if(!command)break;
   at+=command[0].length;needsAtom=needsRightAtom.has(command[1]);continue;
  }
  if(char==='{'){const end=groupEnd(text,at);if(end===at)break;at=end;needsAtom=false;continue;}
  if(char==='['){const end=groupEnd(text,at);if(end===at)break;at=end;continue;}
  if(char==='('){parenDepth++;at++;continue;}
  if(char===')'){if(!parenDepth)break;parenDepth--;at++;continue;}
  if(/[A-Za-z0-9_^=+*/<>-]/u.test(char)){at++;needsAtom=false;continue;}
  if(char===','&&parenDepth){at++;continue;}
  if(/\s/u.test(char)){
   const next=/\S/u.exec(text.slice(at));if(!next)break;const nextAt=at+next.index;
   if(text[nextAt]==='\\'&&/[A-Za-z]/u.test(text[nextAt+1]??'')){at=nextAt;continue;}
   if(needsAtom&&/^(?:[A-Za-z]|\d+)(?=$|[\s.,;:!?)}_+=<>-])/u.test(text.slice(nextAt))){at=nextAt;continue;}
   break;
  }
  break;
 }
 return at;
}

/** Segments retain byte-for-byte original strings so rendering never changes saved source/anchor identities. */
export function splitSourceMath(text:string):SourceMathPart[]{
 const parts:SourceMathPart[]=[];let start=0,index=0;
 const append=(from:number,to:number,latex:string)=>{if(from>start)parts.push({kind:'text',raw:text.slice(start,from)});parts.push({kind:'math',raw:text.slice(from,to),latex});start=to;index=to;};
 while(index<text.length){
  if(text[index]==='`'){const end=text.indexOf('`',index+1);index=end<0?text.length:end+1;continue;}
  if(text.startsWith('\\(',index)&&!escaped(text,index)){
   const end=text.indexOf('\\)',index+2);if(end>=0&&end-index<=MAX_INLINE_MATH){append(index,end+2,text.slice(index+2,end));continue;}
  }
  if(text[index]==='$'&&!escaped(text,index)){
   const delimiter=text.startsWith('$$',index)?'$$':'$',from=index+delimiter.length;let end=text.indexOf(delimiter,from);
   while(end>=0&&escaped(text,end))end=text.indexOf(delimiter,end+delimiter.length);
   const candidate=end>=0?text.slice(from,end):'';
   // Avoid turning currency such as "$5 and $10" into a formula.
   if(candidate&&candidate===candidate.trim()&&!candidate.includes('\n')&&candidate.length<=MAX_INLINE_MATH&&!/\d/u.test(text[end+delimiter.length]??'')&&!(/\b[A-Za-z]{2,}\b/u.test(candidate)&&!/[\\=+*/_^<>-]/u.test(candidate))){append(index,end+delimiter.length,candidate);continue;}
  }
  if(text[index]==='\\'&&!escaped(text,index)&&/[A-Za-z]/u.test(text[index+1]??'')){
   let from=index;while(from>start&&/[A-Za-z0-9_=^():,+*/<>[\]|-]/u.test(text[from-1]))from--;
   const end=rawMathEnd(text,index);if(end>index){append(from,end,text.slice(from,end));continue;}
  }
  index++;
 }
 if(start<text.length)parts.push({kind:'text',raw:text.slice(start)});
 return parts;
}

/** Rendering is bounded and untrusted; unsupported syntax stays readable as its exact original text. */
export function renderSourceMath(latex:string):string|null{
 if(!latex||latex.length>MAX_INLINE_MATH)return null;
 try{return katex.renderToString(latex,{displayMode:false,throwOnError:true,trust:false,strict:'ignore',maxExpand:100,maxSize:4,output:'htmlAndMathml'});}catch{return null;}
}
