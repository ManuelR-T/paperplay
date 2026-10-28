import {MAX_ASSET_FILE_BYTES,type ScientificAsset} from '../../shared/scientific-assets';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import {importScientificData} from '../assets/import';
import {sealScientificAsset} from '../assets/local';

export type BrokerLocalFilePreview=Readonly<{kind:'broker-local-file-preview';fileName:string;byteLength:number;requiresConfirmation:true;asset:ScientificAsset;disclosure:string}>;
/** Local parsing only. Returning a preview does not bind, upload or save the asset. */
export async function importBrokerLocalFile(file:Pick<File,'name'|'size'|'arrayBuffer'>,source?:SourceDocument):Promise<BrokerLocalFilePreview>{
 if(!Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_ASSET_FILE_BYTES)throw Error('Choose a local data file below 2 MiB.');
 if(!/\.(csv|json)$/i.test(file.name))throw Error('Choose a reviewed CSV or JSON local data file.');
 const original=source?validateDocument(source):undefined,bytes=await file.arrayBuffer();
 if(bytes.byteLength!==file.size||bytes.byteLength>MAX_ASSET_FILE_BYTES)throw Error('Local file bytes differ from the bounded selection.');
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('Choose a UTF-8 CSV or JSON local data file.');}
 const asset=await importScientificData(file.name,text,{source:original});
 return Object.freeze({kind:'broker-local-file-preview',fileName:file.name.slice(0,200),byteLength:bytes.byteLength,requiresConfirmation:true,asset,disclosure:'Parsed in this browser only. No network request was sent. Inspect the columns, units, provenance and redistribution rights, then explicitly confirm before binding this asset to the study.'});
}

/** Explicitly requested teaching input, never a source observation or automatic upload selection. */
export async function createBrokerDemoAsset(){
 return sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'broker-demo-two-rows',label:'Two synthetic engineering-demo rows',kind:'table',shape:[2,2],coordinates:{system:'Authored dimensionless test values',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Paperplay-authored deterministic engineering fixture; no empirical observations.',rights:'Project-authored synthetic values'},transformations:[],data:{columns:[{id:'input',label:'Synthetic input',type:'number',unit:'1'},{id:'output',label:'Synthetic output',type:'number',unit:'1'}],rows:[{id:'demo-a',values:[1,2]},{id:'demo-b',values:[2,4]}]}});
}
