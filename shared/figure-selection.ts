import type { SdkFrame } from './figure-sdk';
import type { SemanticSelection } from './semantic-selections';
export function sdkSelectionRevision(artifactHash:string,frame:SdkFrame|null){const value=artifactHash+'|'+JSON.stringify([...new Set(frame?.marks.flatMap(mark=>mark.entityId?[mark.entityId]:[])??[])].sort());let hash=0xcbf29ce484222325n;for(const byte of new TextEncoder().encode(value))hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);return hash.toString(16).padStart(16,'0');}
export function isSdkSelection(artifactId:string,frame:SdkFrame|null,selection:SemanticSelection){return selection.kind==='entity'&&selection.viewId===artifactId&&selection.scopeId==='sdk'&&!!frame?.marks.some(mark=>mark.entityId===selection.entityId);}
