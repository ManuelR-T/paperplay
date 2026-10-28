import type { ScientificAsset } from '../../shared/scientific-assets';
import { hasCheckedAssetIntegrity } from '../assets/local';
import { inspectImageBytes,MAX_IMAGE_BYTES } from './image-bytes';
const admittedImages:Readonly<Record<string,{path:string;sha256:string}>>=Object.freeze({
 'https://wwwn.cdc.gov/phil/PHIL_Images/259/259_lores.jpg':Object.freeze({path:'/scientific-images/cdc-phil-259.jpg',sha256:'821ee79de51d29f154970eef816521388caa11335c1ac6339e86e38d53839565'}),
});
export async function loadSpatialImage(asset:ScientificAsset,expectedSha256?:string,signal?:AbortSignal){
 if(asset.kind!=='image'||!hasCheckedAssetIntegrity(asset)||!asset.data.url)throw Error('Load an integrity-checked original image reference first.');
 if(expectedSha256&&asset.provenance.fileDigest&&expectedSha256!==asset.provenance.fileDigest)throw Error('Image and source byte digests disagree.');
 const bundled=admittedImages[asset.data.url],expected=expectedSha256??asset.provenance.fileDigest??bundled?.sha256;
 const target=bundled?.path??asset.data.url;
 // Invoked only by an explicit reader action. No server proxy or credentials to external hosts.
 const response=await fetch(target,{signal,credentials:'same-origin',redirect:'error',referrerPolicy:'no-referrer'});
 if(!response.ok||!response.body)throw Error(`Original image is unavailable (${response.status}); the source link remains available.`);
 const declared=Number(response.headers.get('content-length')??0);if(declared>MAX_IMAGE_BYTES){await response.body.cancel();throw Error('Original image exceeds the 2 MiB preview budget.');}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{while(true){if(signal?.aborted)throw new DOMException('Image load cancelled.','AbortError');const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_IMAGE_BYTES)throw Error('Original image exceeds the streaming preview budget.');chunks.push(part.value);}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const metadata=inspectImageBytes(bytes),digest=await crypto.subtle.digest('SHA-256',bytes),sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
 if(expected&&expected!==sha256)throw Error('Loaded source pixels differ from the expected byte digest; the prior source was retained.');
 if(asset.shape.length&&(asset.shape[0]!==metadata.height||asset.shape[1]!==metadata.width))throw Error('Image dimensions differ from the source manifest.');
 return {...metadata,sha256,blob:new Blob([bytes],{type:metadata.mime}),bundled:!!bundled,sourceUrl:asset.data.url};
}
