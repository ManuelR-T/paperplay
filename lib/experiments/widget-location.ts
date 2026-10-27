const MAX_ENCODED=90000;
/** Read only a bounded navigation reference. Activation still needs full widget/source validation. */
export function peekWidgetLocation(encoded:string):{documentId:string;sourceVersion:string;kind:string}{
  if(encoded.length>MAX_ENCODED||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('The shared widget URL is damaged or exceeds its size limit.');
  let value:unknown;try{const raw=atob(encoded.replaceAll('-','+').replaceAll('_','/'));value=JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));}catch{throw Error('The shared widget URL could not be decoded.');}
  const x=value as {format?:unknown;source?:{documentId?:unknown;sourceVersion?:unknown};spec?:{kind?:unknown}};
  if(x?.format!=='paperplay-widget'||typeof x.source?.documentId!=='string'||x.source.documentId.length>100||typeof x.source.sourceVersion!=='string'||x.source.sourceVersion.length>100||typeof x.spec?.kind!=='string'||x.spec.kind.length>40)throw Error('The shared widget has no valid source reference.');
  return {documentId:x.source.documentId,sourceVersion:x.source.sourceVersion,kind:x.spec.kind};
}
