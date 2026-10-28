import { z } from 'zod';
import { name, text } from './widget-primitives';
export type Dimensions=readonly [number,number,number,number,number,number,number];
export const UNIT_IDS=['1','%','index','m','cm','mm','um','nm','km','kg','g','mg','s','ms','us','min','h','A','K','degC','mol','mmol','umol','cd','m3','L','mL','m/s','m/s2','Hz','N','Pa','kPa','J','W','mol/L','mmol/L','umol/L','kg/m3','g/L','mg/mL'] as const;
export type UnitId=typeof UNIT_IDS[number];
type Unit={symbol:string;dimensions:Dimensions;scale:number;offset:number;semantic:'physical'|'dimensionless'|'index'};
const dim=(length=0,mass=0,time=0,current=0,temperature=0,amount=0,luminous=0):Dimensions=>[length,mass,time,current,temperature,amount,luminous];
const u=(symbol:string,dimensions:Dimensions,scale=1,offset=0,semantic:Unit['semantic']='physical'):Unit=>Object.freeze({symbol,dimensions:Object.freeze(dimensions),scale,offset,semantic});
export const scientificUnits:Readonly<Record<UnitId,Unit>>=Object.freeze({
 '1':u('dimensionless',dim(),1,0,'dimensionless'),'%':u('%',dim(),.01,0,'dimensionless'),index:u('index',dim(),1,0,'index'),
 m:u('m',dim(1)),cm:u('cm',dim(1),.01),mm:u('mm',dim(1),.001),um:u('µm',dim(1),1e-6),nm:u('nm',dim(1),1e-9),km:u('km',dim(1),1000),
 kg:u('kg',dim(0,1)),g:u('g',dim(0,1),.001),mg:u('mg',dim(0,1),1e-6),s:u('s',dim(0,0,1)),ms:u('ms',dim(0,0,1),.001),us:u('µs',dim(0,0,1),1e-6),min:u('min',dim(0,0,1),60),h:u('h',dim(0,0,1),3600),
 A:u('A',dim(0,0,0,1)),K:u('K',dim(0,0,0,0,1)),degC:u('°C',dim(0,0,0,0,1),1,273.15),mol:u('mol',dim(0,0,0,0,0,1)),mmol:u('mmol',dim(0,0,0,0,0,1),.001),umol:u('µmol',dim(0,0,0,0,0,1),1e-6),cd:u('cd',dim(0,0,0,0,0,0,1)),
 m3:u('m³',dim(3)),L:u('L',dim(3),.001),mL:u('mL',dim(3),1e-6),'m/s':u('m/s',dim(1,0,-1)),'m/s2':u('m/s²',dim(1,0,-2)),Hz:u('Hz',dim(0,0,-1)),N:u('N',dim(1,1,-2)),Pa:u('Pa',dim(-1,1,-2)),kPa:u('kPa',dim(-1,1,-2),1000),J:u('J',dim(2,1,-2)),W:u('W',dim(2,1,-3)),
 'mol/L':u('mol/L',dim(-3,0,0,0,0,1),1000),'mmol/L':u('mmol/L',dim(-3,0,0,0,0,1)),'umol/L':u('µmol/L',dim(-3,0,0,0,0,1),.001),'kg/m3':u('kg/m³',dim(-3,1)),'g/L':u('g/L',dim(-3,1)),'mg/mL':u('mg/mL',dim(-3,1)),
});
export const unitIdSchema=z.enum(UNIT_IDS);
export const temperatureModeSchema=z.enum(['absolute','difference']);
const finite=z.number().finite();
export const scientificCoordinatesSchema=z.strictObject({frame:name,system:z.enum(['cartesian','image-grid','indexed']),orientation:z.enum(['right-handed','left-handed','unspecified']),axes:z.array(z.strictObject({id:name,label:text.max(80),unit:unitIdSchema,temperatureMode:temperatureModeSchema.optional(),origin:finite,spacing:z.number().finite().positive(),direction:z.union([z.literal(1),z.literal(-1)])})).min(1).max(4)});
const uncertainty=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('standard'),values:z.array(z.number().finite().nonnegative()).min(1).max(32768)}),z.strictObject({kind:z.literal('interval'),lower:z.array(finite).min(1).max(32768),upper:z.array(finite).min(1).max(32768)})]);
const base={format:z.literal('paperplay-quantity'),schemaVersion:z.literal(1),unitCatalogVersion:z.literal('1.0.0'),id:name,frame:name.optional(),label:text.max(200),unit:unitIdSchema,temperatureMode:temperatureModeSchema.optional(),uncertainty:uncertainty.optional()};
export const scientificQuantitySchema=z.discriminatedUnion('kind',[
 z.strictObject({...base,kind:z.literal('scalar'),value:finite}),
 z.strictObject({...base,kind:z.literal('vector'),values:z.array(finite).min(1).max(32768)}),
 z.strictObject({...base,kind:z.literal('matrix'),values:z.array(z.array(finite).min(1).max(256)).min(1).max(256)}),
 z.strictObject({...base,kind:z.literal('field'),shape:z.array(z.number().int().min(1).max(32768)).min(1).max(4),values:z.array(finite).min(1).max(32768),coordinates:scientificCoordinatesSchema}),
]);
export type ScientificQuantity=z.infer<typeof scientificQuantitySchema>;
export type ScientificCoordinates=z.infer<typeof scientificCoordinatesSchema>;
export const quantityRequirementSchema=z.strictObject({kind:z.enum(['scalar','vector','matrix','field']),unit:unitIdSchema,temperatureMode:temperatureModeSchema.optional(),shape:z.array(z.number().int().positive()).max(4),frame:name.optional(),coordinates:scientificCoordinatesSchema.optional()});
export type QuantityRequirement=z.infer<typeof quantityRequirementSchema>;
export function quantityValues(quantity:ScientificQuantity):number[]{return quantity.kind==='scalar'?[quantity.value]:quantity.kind==='matrix'?quantity.values.flat():quantity.values;}
export function quantityShape(quantity:ScientificQuantity):number[]{return quantity.kind==='scalar'?[]:quantity.kind==='matrix'?[quantity.values.length,quantity.values[0].length]:quantity.kind==='field'?quantity.shape:[quantity.values.length];}
export function validateScientificCoordinates(input:unknown):ScientificCoordinates {
 const coordinates=scientificCoordinatesSchema.parse(input);
 if(new Set(coordinates.axes.map(axis=>axis.id)).size!==coordinates.axes.length)throw Error('Coordinate axis IDs must be unique.');
 for(const axis of coordinates.axes){const unit=scientificUnits[axis.unit],temperature=unit.dimensions[4]===1;if(temperature&&!axis.temperatureMode||!temperature&&axis.temperatureMode)throw Error('Coordinate temperatures require an explicit absolute/difference interpretation.');if(axis.temperatureMode==='absolute'&&axis.origin*unit.scale+unit.offset<0)throw Error('Coordinate temperature origin is below zero kelvin.');}
 return coordinates;
}
export function validateScientificQuantity(input:unknown):ScientificQuantity {
 const q=scientificQuantitySchema.parse(input),values=quantityValues(q),definition=scientificUnits[q.unit],isTemperature=definition.dimensions[4]===1;
 if(values.length>32768)throw Error('Quantity exceeds 32,768 values.');
 if(isTemperature&&!q.temperatureMode||!isTemperature&&q.temperatureMode)throw Error('Temperature values must explicitly distinguish absolute points from differences.');
 if(q.temperatureMode==='absolute'&&values.some(value=>value*definition.scale+definition.offset<0))throw Error('Absolute temperature is below zero kelvin.');
 if(q.kind==='matrix'&&q.values.some(row=>row.length!==q.values[0].length))throw Error('A quantity matrix must be rectangular.');
 if(q.kind==='field')validateScientificCoordinates(q.coordinates);
 if(q.kind==='field'&&(q.shape.reduce((a,b)=>a*b,1)!==q.values.length||q.coordinates.axes.length!==q.shape.length||new Set(q.coordinates.axes.map(axis=>axis.id)).size!==q.coordinates.axes.length))throw Error('Field shape and coordinate axes must match its values.');
 const uncertainty=q.uncertainty;
 if(uncertainty){if(uncertainty.kind==='standard'&&uncertainty.values.length!==values.length)throw Error('Standard uncertainties must match the quantity shape.');if(uncertainty.kind==='interval'&&(uncertainty.lower.length!==values.length||uncertainty.upper.length!==values.length||uncertainty.lower.some((value,index)=>value>uncertainty.upper[index])))throw Error('Uncertainty intervals must match the quantity and have ordered bounds.');}
 return q;
}
