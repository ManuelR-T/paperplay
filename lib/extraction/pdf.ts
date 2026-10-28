import type {PdfCoordinateFrame} from '../../shared/extraction-evidence';
import {pdfCoordinateFrameSchema} from '../../shared/extraction-evidence';
/** Only actual PDF.js metadata is accepted. Missing fake/unsupported fields remain unknown, never fabricated. */
export function readPdfCoordinateFrame(page:{view?:unknown;rotate?:unknown;userUnit?:unknown},viewport:{transform?:unknown;width?:unknown;height?:unknown;viewBox?:unknown}):PdfCoordinateFrame|null{
 const view=page.view??viewport.viewBox;if(!Array.isArray(view)||view.length!==4||typeof page.rotate!=='number'||typeof page.userUnit!=='number')return null;
 const candidate={coordinateSpace:'pdf-user-space',viewBox:view,rotation:((page.rotate%360)+360)%360,userUnit:page.userUnit,viewportTransform:Array.isArray(viewport.transform)&&viewport.transform.length===6?viewport.transform:null,viewport:typeof viewport.width==='number'&&typeof viewport.height==='number'&&viewport.width>0&&viewport.height>0?{width:viewport.width,height:viewport.height,scale:1}:null};const result=pdfCoordinateFrameSchema.safeParse(candidate);return result.success&&result.data.viewBox[2]>result.data.viewBox[0]&&result.data.viewBox[3]>result.data.viewBox[1]?result.data:null;
}
/** A display transform only; PDF user units/font sizes never imply micrometre or physical image calibration. */
export function projectPdfPoint(frame:PdfCoordinateFrame,point:[number,number]):[number,number]{const valid=pdfCoordinateFrameSchema.parse(frame),t=valid.viewportTransform;if(!t)throw Error('The original PDF viewport transform is unavailable.');if(!point.every(Number.isFinite))throw Error('PDF point must be finite.');const out:[number,number]=[t[0]*point[0]+t[2]*point[1]+t[4],t[1]*point[0]+t[3]*point[1]+t[5]];if(!out.every(Number.isFinite))throw Error('PDF point exceeds finite display coordinates.');return out;}
/** Bound optional inventory APIs. Aborting stops the caller; late PDF.js callbacks cannot append evidence. */
export async function optionalPdfInventory<T>(work:()=>Promise<T>,signal?:AbortSignal,timeoutMs=1000):Promise<{state:'available';value:T}|{state:'unavailable'}>{
 if(signal?.aborted)throw new DOMException('PDF import cancelled.','AbortError');let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
 try{return await Promise.race([Promise.resolve().then(work).then(value=>({state:'available' as const,value}),()=>({state:'unavailable' as const})),new Promise<{state:'unavailable'}>((resolve,reject)=>{timer=setTimeout(()=>resolve({state:'unavailable'}),timeoutMs);abort=()=>reject(new DOMException('PDF import cancelled.','AbortError'));signal?.addEventListener('abort',abort,{once:true});})]);}finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

/** Core extraction failures retain their original PDF.js error class; optional APIs alone may be unavailable. */
export async function boundedPdfWork<T>(work:()=>Promise<T>,signal?:AbortSignal,timeoutMs=30000):Promise<T>{
 if(signal?.aborted)throw new DOMException('PDF import cancelled.','AbortError');let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
 try{return await Promise.race([Promise.resolve().then(work),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('The PDF could not be read within the bounded extraction deadline.')),Math.max(1,timeoutMs));abort=()=>reject(new DOMException('PDF import cancelled.','AbortError'));signal?.addEventListener('abort',abort,{once:true});})]);}finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
