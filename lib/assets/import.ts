import { MAX_ASSET_FILE_BYTES, type ScientificAsset } from '../../shared/scientific-assets';
import type { SourceDocument } from '../../shared/schema';
import { sealScientificAsset, sha256, validateScientificAsset } from './local';

/** RFC-style quoted cells, bounded before parsing; no expressions or formulas execute. */
export function parseCsv(text:string):string[][] {
  if(new TextEncoder().encode(text).length>MAX_ASSET_FILE_BYTES)throw Error('Choose a CSV below 2 MiB.');
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
  function field(){row.push(cell);cell='';closed=false;if(row.length>32)throw Error('Use at most 32 columns.');}
  function line(){field();rows.push(row);row=[];if(rows.length>1001)throw Error('Use at most 1,000 data rows.');}
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell||closed)throw Error('A quoted CSV field must start at its boundary.');quoted=true;}
    else if(c===',')field();else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();}
    else{if(closed)throw Error('Unexpected text after a quoted CSV field.');cell+=c;}
  }
  if(quoted)throw Error('A CSV quoted field is not closed.');if(cell||row.length||closed)line();
  if(!rows.length||!rows[0].length)throw Error('The CSV has no header.');
  const headers=rows[0].map(header=>header.trim());if(headers.some(header=>!header)||new Set(headers).size!==headers.length)throw Error('CSV headers must be nonempty and unique.');
  if(rows.slice(1).some(row=>row.length!==headers.length))throw Error('CSV rows have inconsistent column counts.');rows[0]=headers;return rows;
}
const numeric=(value:unknown)=>{
  if(typeof value==='number')return Number.isFinite(value)&&(!Number.isInteger(value)||Number.isSafeInteger(value));
  if(typeof value!=='string'||!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value))return false;
  const number=Number(value);return Number.isFinite(number)&&(!Number.isInteger(number)||Number.isSafeInteger(number));
};
export async function importScientificData(filename:string,text:string,options:{id?:string;source?:SourceDocument}={}):Promise<ScientificAsset>{
  if(new TextEncoder().encode(text).length>MAX_ASSET_FILE_BYTES)throw Error('Choose data below 2 MiB.');
  const fileDigest=await sha256(text);let headers:string[],cells:unknown[][];
  if(filename.toLowerCase().endsWith('.csv')){const rows=parseCsv(text);headers=rows[0];cells=rows.slice(1).map(row=>row.map(value=>value===''?null:value));}
  else if(filename.toLowerCase().endsWith('.json')){
    const value=JSON.parse(text);
    if(value?.format==='paperplay-scientific-asset'){
      const asset=await validateScientificAsset(value,options.source);if(options.id&&asset.id!==options.id)throw Error(`This asset uses ID ${asset.id}; the representation requires ${options.id}. Import its matching manifest.`);return asset;
    }
    if(!Array.isArray(value)||!value.length||value.length>1000||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('Use a JSON array of row objects or a scientific asset manifest.');
    headers=Object.keys(value[0]);if(!headers.length||headers.length>32)throw Error('Use 1–32 table columns.');
    cells=value.map(row=>{if(Object.keys(row).some(key=>!headers.includes(key)))throw Error('A JSON row contains undeclared columns.');return headers.map(key=>Object.hasOwn(row,key)?row[key]:null);});
  } else throw Error('Choose a CSV or JSON data file.');
  const columns=headers.map((label,index)=>({id:`c${index}`,label,type:cells.some(row=>row[index]!==null)&&cells.every(row=>row[index]===null||numeric(row[index]))?'number' as const:'text' as const,unit:'unspecified'}));
  const rows=cells.map((row,index)=>({id:`r${index}`,values:row.map((value,column)=>{if(value===null)return null;if(typeof value!=='number'&&typeof value!=='string')throw Error('Table cells must be finite numbers, text or null.');if(typeof value==='number'&&(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value)))throw Error('A table number is not finite or its integer precision is unsafe. Quote large identifiers as text.');return columns[column].type==='number'?Number(value):String(value);})}));
  return sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:options.id??`asset-${fileDigest.slice(0,24)}`,label:filename.slice(0,200),kind:'table',shape:[rows.length,columns.length],coordinates:{system:'Imported table order; no scientific coordinate system inferred.',axes:[{label:'Row',unit:'index',direction:'increasing'},{label:'Column',unit:'index',direction:'increasing'}]},missingValues:'null',provenance:{origin:'user-supplied',attribution:'Locally supplied by the reader; not independently verified.',rights:'Private local input. Redistribution rights have not been established.',fileDigest},transformations:[{name:'table-import',description:'Headers retained; empty CSV fields and missing JSON keys become null. Whole-column numeric inference preserves leading-zero identifiers as text.'}],data:{columns,rows}});
}
