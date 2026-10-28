import {SUPPLEMENT_DESCRIPTORS,supplementMetadata,validateSupplementReview,verifySupplementBytes,type SupplementReview} from '../../lib/extraction/supplements';

/** Only this exact public path was inspected: no redirects occurred in the admission download. */
const reviewedDestinations=new Set<string>([SUPPLEMENT_DESCRIPTORS[0].downloadUrl]);
export function createSupplementService(options:{fetcher?:typeof fetch;now?:()=>number;verifyBytes?:typeof verifySupplementBytes}={}){
 let cached:{bytes:Uint8Array;at:number}|undefined;let pending:Promise<Uint8Array>|undefined;
 const now=options.now??Date.now,verify=options.verifyBytes??verifySupplementBytes;
 async function download(signal?:AbortSignal){
  if(cached&&now()-cached.at<300000)return new Uint8Array(cached.bytes);
  if(pending)return new Uint8Array(await pending);
  const work=(async()=>{
   const descriptor=SUPPLEMENT_DESCRIPTORS[0],timeout=AbortSignal.timeout(12000),combined=signal?AbortSignal.any([signal,timeout]):timeout;let target:string=descriptor.downloadUrl;
   for(let redirects=0;redirects<=3;redirects++){
    if(!reviewedDestinations.has(target))throw Error('The supplement redirected outside its exact reviewed destination.');
    // The archive negotiates this attachment as */*; a MIME-specific Accept yields 406.
    // Admission still requires the exact response MIME, size, signature and pinned digest.
    const response=await (options.fetcher??fetch)(target,{redirect:'manual',credentials:'omit',signal:combined,headers:{Accept:'*/*','Accept-Encoding':'identity','User-Agent':'Paperplay/1.1 (explicit reviewed public supplement retrieval)'}});
    if([301,302,303,307,308].includes(response.status)){
     const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('The supplement returned a redirect without a destination.');const next=new URL(location,target);if(next.username||next.password||!reviewedDestinations.has(next.href))throw Error('The supplement redirected outside its exact reviewed destination.');target=next.href;continue;
    }
    if(!response.ok){await response.body?.cancel();throw Error('The official supplement is unavailable; access restrictions were not bypassed.');}
    const mediaType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase(),encoding=response.headers.get('content-encoding');
    if(mediaType!==descriptor.mediaType||encoding&&encoding!=='identity'){await response.body?.cancel();throw Error('The supplement media type or content encoding differs from its reviewed edition.');}
    const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)!==descriptor.byteLength)){await response.body?.cancel();throw Error('The declared supplement size differs from the pinned file.');}
    const reader=response.body?.getReader();if(!reader)throw Error('The supplement response is empty.');const chunks:Uint8Array[]=[];let length=0;
    try{while(true){if(combined.aborted)throw new DOMException('Supplement retrieval cancelled.','AbortError');const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>Math.min(2*1024*1024,descriptor.byteLength)){await reader.cancel();throw Error('The supplement stream exceeds the exact reviewed byte bound.');}chunks.push(part.value);}}
    finally{reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(bytes.byteLength!==descriptor.byteLength)throw Error('The actual supplement size differs from the pinned file.');
    await verify(bytes);if(combined.aborted)throw new DOMException('Supplement retrieval cancelled.','AbortError');cached={bytes:new Uint8Array(bytes),at:now()};return bytes;
   }
   throw Error('The supplement returned too many redirects.');
  })();pending=work;try{return new Uint8Array(await work);}finally{pending=undefined;}
 }
 return {async retrieve(raw:SupplementReview,signal?:AbortSignal){const review=await validateSupplementReview(raw);if(signal?.aborted)throw new DOMException('Supplement retrieval cancelled.','AbortError');const bytes=await download(signal);if(signal?.aborted)throw new DOMException('Supplement retrieval cancelled.','AbortError');return {metadata:supplementMetadata(review),bytes};}};
}
