import { scientificUnits, unitIdSchema, quantityValues, quantityShape, quantityRequirementSchema, validateScientificQuantity, scientificCoordinatesSchema, validateScientificCoordinates, type ScientificQuantity, type ScientificCoordinates, type UnitId, type QuantityRequirement } from '../../shared/scientific-quantities';
const temperature=(unit:UnitId)=>scientificUnits[unit].dimensions[4]===1;
export function compatibleUnits(left:UnitId,right:UnitId){left=unitIdSchema.parse(left);right=unitIdSchema.parse(right);const a=scientificUnits[left],b=scientificUnits[right];return a.semantic===b.semantic&&a.dimensions.every((power,index)=>power===b.dimensions[index]);}
export function convertValue(value:number,from:UnitId,to:UnitId,mode?:'absolute'|'difference'){
 if(!Number.isFinite(value)||!compatibleUnits(from,to))throw Error('Conversion requires finite values and compatible dimensions; indices need an explicit physical calibration.');
 if(temperature(from)?!mode:!!mode)throw Error('Temperature conversion requires an explicit absolute/difference interpretation.');
 const a=scientificUnits[from],b=scientificUnits[to],base=value*a.scale+(mode==='absolute'?a.offset:0);
 if(mode==='absolute'&&base<0)throw Error('Absolute temperature is below zero kelvin.');
 if(from===to)return value;
 const output=(base-(mode==='absolute'?b.offset:0))/b.scale;if(!Number.isFinite(output))throw Error('Unit conversion exceeded finite values.');return output;
}
function withValues(quantity:ScientificQuantity,values:number[]):ScientificQuantity {
 if(quantity.kind==='scalar')return {...quantity,value:values[0]};
 if(quantity.kind==='matrix'){const width=quantity.values[0].length;return {...quantity,values:quantity.values.map((_,index)=>values.slice(index*width,(index+1)*width))};}
 return {...quantity,values};
}
export function convertQuantity(input:ScientificQuantity,to:UnitId):ScientificQuantity {
 const q=validateScientificQuantity(input);to=unitIdSchema.parse(to);
 let next=withValues(q,quantityValues(q).map(value=>convertValue(value,q.unit,to,q.temperatureMode)));next={...next,unit:to};
 if(q.uncertainty){
   if(q.uncertainty.kind==='standard')next.uncertainty={kind:'standard',values:q.uncertainty.values.map(value=>Math.abs(convertValue(value,q.unit,to,temperature(q.unit)?'difference':undefined)))};
   else next.uncertainty={kind:'interval',lower:q.uncertainty.lower.map(value=>convertValue(value,q.unit,to,q.temperatureMode)),upper:q.uncertainty.upper.map(value=>convertValue(value,q.unit,to,q.temperatureMode))};
 }
 return validateScientificQuantity(next);
}
export function convertCoordinates(input:ScientificCoordinates,units:Partial<Record<string,UnitId>>):ScientificCoordinates {
 const coordinates=validateScientificCoordinates(input);
 if(Object.keys(units).some(id=>!coordinates.axes.some(axis=>axis.id===id)))throw Error('A target coordinate axis is unavailable.');
 return scientificCoordinatesSchema.parse({...coordinates,axes:coordinates.axes.map(axis=>{const to=units[axis.id]??axis.unit;return {...axis,unit:to,origin:convertValue(axis.origin,axis.unit,to,axis.temperatureMode),spacing:convertValue(axis.spacing,axis.unit,to,temperature(axis.unit)?'difference':undefined)};})});
}
const near=(left:number,right:number,bound:number)=>Math.abs(left-right)<=Math.min(8*Number.EPSILON*Math.max(1,Math.abs(left),Math.abs(right)),bound);
export function compatibleCoordinates(left:ScientificCoordinates,right:ScientificCoordinates){
 left=validateScientificCoordinates(left);right=validateScientificCoordinates(right);
 if(left.frame!==right.frame||left.system!==right.system||left.orientation!==right.orientation||left.axes.length!==right.axes.length)return false;
 return left.axes.every((axis,index)=>{const other=right.axes[index];if(axis.id!==other.id||axis.direction!==other.direction||axis.temperatureMode!==other.temperatureMode||!compatibleUnits(axis.unit,other.unit))return false;try{const origin=convertValue(other.origin,other.unit,axis.unit,axis.temperatureMode),spacing=convertValue(other.spacing,other.unit,axis.unit,temperature(axis.unit)?'difference':undefined),bound=Math.min(axis.spacing,spacing)*1e-9;return near(axis.origin,origin,bound)&&near(axis.spacing,spacing,bound);}catch{return false;}});
}
/** Numerical/view adapters call this before consuming a quantity. No interpolation or frame rotation is implied. */
export function bindScientificQuantity(input:ScientificQuantity,expected:QuantityRequirement):ScientificQuantity {
 const q=validateScientificQuantity(input),requirement=quantityRequirementSchema.parse(expected);
 if(q.kind!==requirement.kind||JSON.stringify(quantityShape(q))!==JSON.stringify(requirement.shape))throw Error('Quantity shape/kind is incompatible with this adapter.');
 if(q.frame!==requirement.frame)throw Error('Quantity frame identity does not match its adapter.');
 if(q.temperatureMode!==requirement.temperatureMode)throw Error('Absolute temperatures and temperature differences cannot be implicitly interchanged.');
 if(q.kind==='field'&&(!requirement.coordinates||!compatibleCoordinates(q.coordinates,requirement.coordinates)))throw Error('Field coordinates differ; align them explicitly before execution.');
 if(q.kind!=='field'&&requirement.coordinates)throw Error('This quantity does not have field coordinates.');
 const bound=convertQuantity(q,requirement.unit);return bound.kind==='field'&&requirement.coordinates?{...bound,coordinates:requirement.coordinates}:bound;
}
export function combineQuantities(left:ScientificQuantity,right:ScientificQuantity,operation:'add'|'subtract'='add'):ScientificQuantity {
 const a=validateScientificQuantity(left),b=validateScientificQuantity(right);
 if(a.kind!==b.kind||JSON.stringify(quantityShape(a))!==JSON.stringify(quantityShape(b))||a.frame!==b.frame)throw Error('Addition/subtraction requires matching quantity shapes and frames.');
 if(a.kind==='field'&&(b.kind!=='field'||!compatibleCoordinates(a.coordinates,b.coordinates)))throw Error('Align field coordinates before combining values.');
 if(a.uncertainty||b.uncertainty)throw Error('Combining uncertainties needs an explicit covariance/independence model.');
 if(!compatibleUnits(a.unit,b.unit))throw Error('Addition/subtraction requires compatible physical dimensions.');
 const absoluteA=a.temperatureMode==='absolute',absoluteB=b.temperatureMode==='absolute';
 if(operation==='add'&&absoluteA&&absoluteB||operation==='subtract'&&!absoluteA&&absoluteB)throw Error('This operation is undefined for absolute temperature points.');
 const unit=operation==='add'&&!absoluteA&&absoluteB?b.unit:a.unit;
 const av=quantityValues(a).map(value=>convertValue(value,a.unit,unit,a.temperatureMode)),bv=quantityValues(b).map(value=>convertValue(value,b.unit,unit,b.temperatureMode));
 const temperatureMode=temperature(unit)?operation==='subtract'&&absoluteA&&absoluteB?'difference':absoluteA||absoluteB?'absolute':'difference':undefined;
 return validateScientificQuantity({...withValues(a,av.map((value,index)=>operation==='add'?value+bv[index]:value-bv[index])),unit,temperatureMode});
}
