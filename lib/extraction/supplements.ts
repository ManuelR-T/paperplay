import {z} from 'zod';
import {brokerCanonicalJson} from '../../shared/external-broker';
import {sha256} from '../assets/local';
import {sha256 as byteHash} from '../import/normalize';

export const SUPPLEMENT_DESCRIPTORS=Object.freeze([Object.freeze({id:'chew-biomass-2212-v1',label:'Chew Arabidopsis biomass workbook, version 1',sourceUrl:'https://fairdomhub.org/data_files/2212?version=1',downloadUrl:'https://fairdomhub.org/data_files/2212/download?version=1',fileName:'Biomass MIR156.xlsx',mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',byteLength:127343,sha256:'98833cf34fda5b598ed0dbb390386abf1797e26b5e9393f5df8a1266c2ff5e68',rights:'CC0-1.0 for the deposited data file; site metadata separately CC BY 4.0.',attribution:'Yin Hoon Chew; deposited by Andrew Millar, FAIRDOMHub data file 2212 version 1. Associated article: 10.1073/pnas.1410238111.',status:'reviewed-available' as const,format:'passive-xlsx' as const})]);
export type SupplementDescriptor=typeof SUPPLEMENT_DESCRIPTORS[number];
export function supplementDescriptorForReference(url:string|null){return SUPPLEMENT_DESCRIPTORS.find(descriptor=>url===descriptor.sourceUrl||url===descriptor.downloadUrl);}
export const SUPPLEMENT_DISCLOSURE=Object.freeze({recipient:'This application server retrieves one registered public file from FAIRDOMHub. No private paper, source text, local asset or credentials are uploaded.',included:'Only the registered file ID, parent-source fingerprint and selected reference identity are sent. The server never fetches a user-supplied URL.',limits:'One pinned workbook, at most 2 MiB and 12 seconds; exact size, SHA-256, media type and ZIP file signature must match.',handling:'Passive original XLSX download only. No workbook cells, formulas, macros, archives or code are executed or promoted into observations.',rights:SUPPLEMENT_DESCRIPTORS[0].rights} as const);
const sha=z.string().regex(/^[a-f0-9]{64}$/);
export const supplementReviewBodySchema=z.strictObject({format:z.literal('paperplay-supplement-review'),schemaVersion:z.literal(1),descriptorId:z.literal('chew-biomass-2212-v1'),parentFingerprint:sha,referenceId:z.string().min(1).max(100),referenceUrl:z.enum([SUPPLEMENT_DESCRIPTORS[0].sourceUrl,SUPPLEMENT_DESCRIPTORS[0].downloadUrl]),disclosure:z.strictObject({recipient:z.literal(SUPPLEMENT_DISCLOSURE.recipient),included:z.literal(SUPPLEMENT_DISCLOSURE.included),limits:z.literal(SUPPLEMENT_DISCLOSURE.limits),handling:z.literal(SUPPLEMENT_DISCLOSURE.handling),rights:z.literal(SUPPLEMENT_DISCLOSURE.rights)})});
export const supplementReviewSchema=supplementReviewBodySchema.extend({reviewSha256:sha});
export type SupplementReview=z.infer<typeof supplementReviewSchema>;
export type PreparedSupplementRetrieval=Readonly<{review:SupplementReview;reviewSha256:string}>;
export const supplementRetrieveSchema=z.strictObject({review:supplementReviewSchema,consent:z.strictObject({accepted:z.literal(true),reviewSha256:sha})});
export const supplementMetadataSchema=z.strictObject({descriptorId:z.literal('chew-biomass-2212-v1'),parentFingerprint:sha,referenceId:z.string().min(1).max(100),referenceUrl:supplementReviewBodySchema.shape.referenceUrl,reviewSha256:sha,sha256:sha,byteLength:z.number().int().min(1).max(2*1024*1024),mediaType:z.string().max(120),fileName:z.string().max(300),rights:z.string().max(1000),attribution:z.string().max(1000),sourceUrl:z.string().max(2000),format:z.literal('passive-xlsx')});
export type SupplementMetadata=z.infer<typeof supplementMetadataSchema>;
const preparedHere=new WeakSet<object>();
export async function validateSupplementReview(raw:unknown){const review=supplementReviewSchema.parse(raw),{reviewSha256,...body}=review;if(await sha256(brokerCanonicalJson(body))!==reviewSha256)throw Error('The supplement disclosure/reference changed. Review the exact selection again.');return review;}
/** Local disclosure only. No original paper, attachment bytes or network request is required. */
export async function prepareSupplementRetrieval(input:{descriptorId:string;parentFingerprint:string;referenceId:string;referenceUrl:string}):Promise<PreparedSupplementRetrieval>{
 const body=supplementReviewBodySchema.parse({format:'paperplay-supplement-review',schemaVersion:1,...input,disclosure:SUPPLEMENT_DISCLOSURE}),reviewSha256=await sha256(brokerCanonicalJson(body));
 const review=Object.freeze({...body,disclosure:SUPPLEMENT_DISCLOSURE,reviewSha256}),prepared=Object.freeze({review,reviewSha256});preparedHere.add(prepared);return prepared;
}
export function supplementMetadata(review:SupplementReview):SupplementMetadata{const descriptor=SUPPLEMENT_DESCRIPTORS[0];return {descriptorId:descriptor.id,parentFingerprint:review.parentFingerprint,referenceId:review.referenceId,referenceUrl:review.referenceUrl,reviewSha256:review.reviewSha256,sha256:descriptor.sha256,byteLength:descriptor.byteLength,mediaType:descriptor.mediaType,fileName:descriptor.fileName,rights:descriptor.rights,attribution:descriptor.attribution,sourceUrl:descriptor.sourceUrl,format:descriptor.format};}
export async function verifySupplementBytes(bytes:Uint8Array){const d=SUPPLEMENT_DESCRIPTORS[0];if(bytes.byteLength!==d.byteLength||bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==3||bytes[3]!==4||await byteHash(bytes)!==d.sha256)throw Error('The registered workbook bytes differ from the reviewed edition. No file was admitted.');}
/** Explicit read-only retrieval. The output remains a passive file, never a ScientificAsset. */
export async function retrieveSupplement(prepared:PreparedSupplementRetrieval,consent:{accepted:true;reviewSha256:string},options:{fetcher?:typeof fetch;signal?:AbortSignal}={}):Promise<{blob:Blob;metadata:SupplementMetadata}>{
 if(!preparedHere.has(prepared))throw Error('Inspect a fresh local supplement disclosure before retrieval.');const review=await validateSupplementReview(prepared.review);
 if(consent.accepted!==true||consent.reviewSha256!==review.reviewSha256||prepared.reviewSha256!==review.reviewSha256)throw Error('Explicit consent must match this exact supplement reference and disclosure.');
 if(options.signal?.aborted)throw new DOMException('Supplement retrieval cancelled.','AbortError');
 const timeout=AbortSignal.timeout(15000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
 const response=await (options.fetcher??fetch)('/api/supplements/retrieve',{method:'POST',credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({review,consent}),signal});
 const reader=response.body?.getReader();if(!reader)throw Error('The supplement response is empty. Open the original link or choose a local file.');
 let length=0;const chunks:Uint8Array[]=[];try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>4*1024*1024){await reader.cancel();throw Error('The supplement response exceeds its transport limit.');}chunks.push(next.value);}}finally{reader.releaseLock();}
 if(!response.ok)throw Error('The reviewed supplement is unavailable. Open its original record or select a local file; access was not bypassed.');
 const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
 const value=z.strictObject({metadata:supplementMetadataSchema,base64:z.string().max(Math.ceil(2*1024*1024/3)*4)}).parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all)));
 if(brokerCanonicalJson(value.metadata)!==brokerCanonicalJson(supplementMetadata(review))||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64))throw Error('The returned supplement metadata differs from the reviewed reference.');
 const binary=atob(value.base64);if(binary.length>2*1024*1024)throw Error('The supplement exceeds its decoded byte limit.');const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));await verifySupplementBytes(bytes);
 if(signal.aborted)throw new DOMException('Supplement retrieval cancelled.','AbortError');
 return {blob:new Blob([bytes],{type:value.metadata.mediaType}),metadata:Object.freeze(value.metadata)};
}
