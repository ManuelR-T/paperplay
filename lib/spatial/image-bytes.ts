import { validateRasterSize } from './model';
export const MAX_IMAGE_BYTES=2*1024*1024;
export function inspectImageBytes(bytes:Uint8Array){
 if(bytes.byteLength>MAX_IMAGE_BYTES)throw Error('Original image exceeds the 2 MiB preview budget.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value)){
   if(String.fromCharCode(...bytes.slice(12,16))!=='IHDR'||view.getUint32(8)!==13)throw Error('Invalid PNG header.');
   const size=validateRasterSize(view.getUint32(16),view.getUint32(20));if(bytes[24]!==8)throw Error('This preview supports eight-bit PNGs; import a typed field for higher-precision scientific values.');
   let offset=8,ended=false,chunks=0;
   while(offset+12<=bytes.length){if(++chunks>2048)throw Error('PNG metadata exceeds preview limits.');const length=view.getUint32(offset),type=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(offset+12+length>bytes.length)throw Error('Truncated PNG data.');
     if(['acTL','fcTL','fdAT','eXIf','iCCP','zTXt','iTXt'].includes(type))throw Error('Animated/oriented or compressed-metadata PNG needs the original viewer; no pixels were silently normalized.');
     offset+=length+12;if(type==='IEND'){if(length!==0||offset!==bytes.length)throw Error('Invalid PNG end marker or trailing data.');ended=true;break;}
   }
   if(!ended)throw Error('PNG end marker is missing.');return {...size,mime:'image/png' as const};
 }
 if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
   if(bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('JPEG end marker is missing; partial pixels are not used for inspection.');
   let offset=2,size:ReturnType<typeof validateRasterSize>|undefined,segments=0;
   while(offset<bytes.length){if(++segments>2048)throw Error('JPEG metadata exceeds preview limits.');if(bytes[offset++]!==255)throw Error('Malformed JPEG marker.');while(bytes[offset]===255)offset++;const marker=bytes[offset++];
     if(marker===217)break;if(marker===218){if(!size)throw Error('JPEG frame header is missing.');return {...size,mime:'image/jpeg' as const};}
     if(marker===1||marker>=208&&marker<=215)continue;
     if(offset+2>bytes.length)throw Error('Truncated JPEG segment.');const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)throw Error('Truncated JPEG metadata.');
     if(marker===225)throw Error('JPEG orientation/APP1 metadata is not normalized by this preview. Open the original image.');
     if(marker===226&&String.fromCharCode(...bytes.slice(offset+2,offset+6))==='MPF\0')throw Error('Multiple-picture JPEG is unsupported.');
     if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
       if(marker!==192||length<8||bytes[offset+2]!==8)throw Error('Only eight-bit baseline JPEG is supported in this bounded preview.');
       if(size)throw Error('Multiple JPEG frame headers are unsupported.');size=validateRasterSize(view.getUint16(offset+5),view.getUint16(offset+3));
     }
     offset+=length;
   }
   throw Error('JPEG scan data is missing.');
 }
 throw Error('Choose an original baseline JPEG or eight-bit PNG; SVG, animated and unknown image formats are not executed.');
}
