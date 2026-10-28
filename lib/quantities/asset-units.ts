import { sealScientificAsset, hasCheckedAssetIntegrity } from '../assets/local';
import { unitIdSchema, scientificUnits, type UnitId } from '../../shared/scientific-quantities';
import type { ScientificAsset } from '../../shared/scientific-assets';
import type { SourceDocument } from '../../shared/schema';
import { convertValue } from './convert';

/** Declaring unspecified units is distinct from converting values with a known unit. */
export async function changeTableUnit(input:ScientificAsset,columnId:string,to:UnitId,mode?:'absolute'|'difference',source?:SourceDocument):Promise<ScientificAsset>{
 if(!hasCheckedAssetIntegrity(input)||input.kind!=='table')throw Error('Choose an integrity-checked table.');
 to=unitIdSchema.parse(to);const column=input.data.columns.find(column=>column.id===columnId);
 if(!column||column.type!=='number')throw Error('Choose a numeric column.');
 const temperature=scientificUnits[to].dimensions[4]===1;
 if(temperature&&!mode||!temperature&&mode)throw Error('Choose absolute temperature or temperature difference for temperature units only.');
 const declared=column.unit==='unspecified',from=declared?to:unitIdSchema.parse(column.unit);
 if(!declared&&column.temperatureMode&&column.temperatureMode!==mode)throw Error('Converting units cannot change absolute temperatures into differences.');
 const index=input.data.columns.indexOf(column);
 const data={columns:input.data.columns.map(item=>item.id===columnId?{...item,unit:to,temperatureMode:mode}:item),rows:input.data.rows.map(row=>({...row,values:row.values.map((value,i)=>i!==index||value===null?value:convertValue(value as number,from,to,mode))}))};
 const {checksum:_,...prior}=input;
 return sealScientificAsset({...prior,data,transformations:[...input.transformations,{name:declared?'reader-unit-declaration':'unit-conversion',description:declared?`Reader declared ${to}${mode?` (${mode})`:''}; values unchanged. This is an assumption, not source verification.`:`Converted ${from} to ${to}${mode?` (${mode})`:''} using SI catalog 1.0.0; missing values retained.`}]},source);
}
