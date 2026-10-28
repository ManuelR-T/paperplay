import { assertBoundedFigureJson } from './figure-json';
type Field={id:string;kind:'number'|'string'|'boolean'|'array'|'object';maxItems?:number};
export function validateArtifactInterface(input:unknown,fields:readonly Field[],maxBytes:number){
 assertBoundedFigureJson(input,maxBytes);if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Artifact interface requires an object.');const data=input as Record<string,unknown>;
 if(Object.keys(data).length!==fields.length||Object.keys(data).some(id=>!fields.some(field=>field.id===id)))throw Error('Artifact fields differ from the declared interface. Supply explicit initial inputs.');
 for(const field of fields){const value=data[field.id];if(field.kind==='array'){if(!Array.isArray(value)||value.length>field.maxItems!)throw Error('Artifact array exceeds its declared shape.');}else if(field.kind==='number'){if(typeof value!=='number'||!Number.isFinite(value))throw Error('Artifact scalar must be finite.');}else if(field.kind==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Artifact object differs.');}else if(typeof value!==field.kind)throw Error('Artifact field type differs.');}
}
