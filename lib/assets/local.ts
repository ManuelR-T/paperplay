import { MAX_ASSET_FILE_BYTES, validateAssetStructure, type ScientificAsset } from '../../shared/scientific-assets';
import { validateDocument, type SourceDocument } from '../../shared/schema';
const checked=new WeakSet<object>();
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>JSON.stringify(key)+':'+canonical(value)).join(',')+'}';return JSON.stringify(value);}
export async function sha256(text:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');}
function checksumInput(asset:ScientificAsset){return canonical({...asset,checksum:undefined});}
function freeze(input:unknown){if(input&&typeof input==='object'){Object.values(input).forEach(freeze);Object.freeze(input);}}
export function hasCheckedAssetIntegrity(input:unknown):input is ScientificAsset{return !!input&&typeof input==='object'&&checked.has(input);}
export async function validateScientificAsset(input:unknown,originalSource?:SourceDocument):Promise<ScientificAsset>{
  if(new TextEncoder().encode(JSON.stringify(input)).length>MAX_ASSET_FILE_BYTES)throw Error('Choose an asset below 2 MiB.');
  const asset=validateAssetStructure(input);
  if(asset.provenance.source){const source=originalSource?validateDocument(originalSource):undefined,ref=asset.provenance.source,block=source?.blocks.find(block=>block.id===ref.blockId);const text=block?.kind==='equation'?block.latex:block?.kind==='original-figure'?block.caption:block?.text;
    if(!source||source.id!==ref.documentId||source.sourceVersion!==ref.sourceVersion||!text?.replace(/\s+/g,' ').includes(ref.quote.replace(/\s+/g,' ')))throw Error('The asset requires its exact cited source.');
    if(asset.kind==='image'&&(block?.kind!=='original-figure'||asset.data.url&&!block.imageUrls?.includes(asset.data.url)))throw Error('An image reference must be retained in its original figure source.');
  }
  if(await sha256(checksumInput(asset))!==asset.checksum.value)throw Error('Asset checksum mismatch; data or metadata changed.');
  freeze(asset);checked.add(asset);return asset;
}
export async function sealScientificAsset(input:Omit<ScientificAsset,'checksum'>,source?:SourceDocument):Promise<ScientificAsset>{
  const asset=validateAssetStructure({...input,checksum:{algorithm:'sha256',scope:'manifest-and-data',value:'0'.repeat(64)}});
  asset.checksum.value=await sha256(checksumInput(asset));return validateScientificAsset(asset,source);
}
export async function originalFigureAssets(source:SourceDocument):Promise<ScientificAsset[]>{
  return Promise.all(source.blocks.filter(block=>block.kind==='original-figure').slice(0,32).map((block,index)=>sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:`original-figure-${index}`,kind:'image',label:block.caption.slice(0,200),shape:[],coordinates:{system:'Original figure reference; pixel dimensions unavailable.',axes:[]},missingValues:'reject',provenance:{origin:'source-extracted',attribution:source.authors.join(' · '),rights:'Original source rights apply; importing does not grant redistribution rights.',source:{documentId:source.id,sourceVersion:source.sourceVersion,blockId:block.id,quote:block.caption.slice(0,1000)}},transformations:[],data:{blockId:block.id,url:block.imageUrls?.[0],alt:block.alt}},source)));
}
