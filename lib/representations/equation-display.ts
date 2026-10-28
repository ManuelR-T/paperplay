import katex from 'katex';
/** Rendering only: no symbolic evaluation, proof checker, trusted HTML or external URLs. */
export function renderReasoningEquation(latex:string,notation:'transcribed'|'uncertain'|'unsupported'):{status:'rendered';html:string}|{status:'raw';reason:string}{
 if(notation!=='transcribed')return {status:'raw',reason:`${notation==='unsupported'?'Unsupported':'Uncertain'} notation; original transcription retained.`};
 if(latex.length>2000)return {status:'raw',reason:'Notation exceeds the display budget; original text retained.'};
 try{return {status:'rendered',html:katex.renderToString(latex,{displayMode:true,throwOnError:true,trust:false,strict:'error',maxExpand:100,maxSize:10,output:'htmlAndMathml'})};}catch{return {status:'raw',reason:'Notation could not be rendered safely; original transcription retained.'};}
}
