import type { ScientificAsset } from '../../shared/scientific-assets';
import { hasCheckedAssetIntegrity } from '../assets/local';
import { validateStatisticalChart,type StatisticalChart,type StatisticalSeries } from '../../shared/statistical-charts';
type Table=Extract<ScientificAsset,{kind:'table'}>;
export type ChartPoint={id:string;rowId:string;x:number|null;y:number|null;lower:number|null;upper:number|null;count:number|null;binLower?:number;binUpper?:number;members?:{rowId:string;value:number}[];replicate:string|number|null;pair:string|number|null};
export type ChartSeries={id:string;label:string;origin:StatisticalSeries['origin'];inputOrigin:ScientificAsset['provenance']['origin'];assetId:string;checksum:string;points:ChartPoint[];missing:number;derivation?:'equal-width-histogram';method?:{name:'ordinary-least-squares';intercept:number;slope:number;n:number};uncertainty?:StatisticalSeries['uncertainty'];interpretation:string};
export type ChartModel={spec:StatisticalChart;series:ChartSeries[];domains:{x:[number,number];y:[number,number]};comparisons:{pair:string|number;left:number;right:number;difference:number}[];warnings:string[]};
function column(asset:Table,id:string,unit?:string){const index=asset.data.columns.findIndex(c=>c.id===id);if(index<0)throw Error(`Column ${id} is missing.`);const c=asset.data.columns[index];if(unit!==undefined&&(c.type!=='number'||c.unit!==unit))throw Error(`Column ${id} requires numeric values in exactly ${unit}; convert/declare units explicitly before plotting.`);return index;}
const number=(value:unknown,label:string)=>{if(value===null)return null;if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${label} requires finite numeric data or explicit null.`);return value;};
export function descriptiveLinearFit(points:readonly {x:number;y:number}[]){
 if(points.length<2)throw Error('A descriptive fit needs at least two valid points.');
 const x=points.reduce((sum,p)=>sum+p.x,0)/points.length,y=points.reduce((sum,p)=>sum+p.y,0)/points.length;
 const denominator=points.reduce((sum,p)=>sum+(p.x-x)**2,0);if(!Number.isFinite(denominator)||denominator<=0)throw Error('A descriptive fit needs finite, varying x values.');
 const slope=points.reduce((sum,p)=>sum+(p.x-x)*(p.y-y),0)/denominator,intercept=y-slope*x;if(!Number.isFinite(slope)||!Number.isFinite(intercept))throw Error('Fit arithmetic exceeded finite bounds.');return {name:'ordinary-least-squares' as const,intercept,slope,n:points.length};
}
function extract(series:StatisticalSeries,chart:StatisticalChart,asset:Table):ChartSeries{
 const xi=column(asset,series.xColumn,chart.x.unit),yi=series.yColumn?column(asset,series.yColumn,chart.y.unit):-1;
 if((series.origin==='observed'||series.origin==='processed')&&asset.provenance.origin==='illustrative')throw Error('Illustrative data cannot be relabeled as observed or processed measurements.');
 const filter=series.filter?column(asset,series.filter.column):-1,replicate=series.replicateColumn?column(asset,series.replicateColumn):-1,count=series.sampleCountColumn?column(asset,series.sampleCountColumn):-1,pair=chart.comparison?column(asset,chart.comparison.pairColumn):-1;
 const uncertainty=series.uncertainty;
 const lower=uncertainty&&'lowerColumn'in uncertainty?column(asset,uncertainty.lowerColumn,chart.y.unit):-1,upper=uncertainty&&'upperColumn'in uncertainty?column(asset,uncertainty.upperColumn,chart.y.unit):-1,spread=uncertainty&&'column'in uncertainty?column(asset,uncertainty.column,chart.y.unit):-1;
 const points:ChartPoint[]=asset.data.rows.filter(row=>!series.filter||row.values[filter]===series.filter.equals).map(row=>{
   const x=number(row.values[xi],'x'),y=yi<0?null:number(row.values[yi],'y');
   let lo=lower<0?null:number(row.values[lower],'Lower uncertainty'),hi=upper<0?null:number(row.values[upper],'Upper uncertainty');
   const error=spread<0?null:number(row.values[spread],'Uncertainty');if(error!==null&&error<0)throw Error('Negative uncertainty is unavailable/invalid, never a negative error bar.');
   if(spread>=0&&error!==null&&y!==null){lo=y-error;hi=y+error;}
   if(lo!==null&&hi!==null&&(lo>hi))throw Error('Uncertainty bounds must increase; no symmetric coverage is inferred.');
   const n=count<0?null:number(row.values[count],'Sample count');if(n!==null&&(!Number.isSafeInteger(n)||n<1))throw Error('Sample counts must be positive safe integers or missing.');
   const value=(index:number)=>index<0?null:row.values[index];
   return {id:`${series.id}:${row.id}`,rowId:row.id,x,y,lower:lo,upper:hi,count:n,replicate:value(replicate),pair:value(pair)};
 });
 if(points.length>1000)throw Error('Choose at most 1,000 rows per chart series.');
 if(series.order==='ascending')points.sort((a,b)=>(a.x??Infinity)-(b.x??Infinity));
 if(chart.kind==='line'&&series.order==='source'&&points.some((point,i)=>i>0&&point.x!==null&&points[i-1].x!==null&&point.x<points[i-1].x!))throw Error('Line x values must increase; explicitly choose ascending order or a scatter view.');
 const missing=points.filter(p=>p.x===null||chart.kind!=='distribution'&&p.y===null).length;
 let method:ChartSeries['method'];
 if(series.fit){method=descriptiveLinearFit(points.filter((p):p is ChartPoint&{x:number;y:number}=>p.x!==null&&p.y!==null));for(const p of points)if(p.x!==null){p.y=method.intercept+method.slope*p.x;if(!Number.isFinite(p.y))throw Error('Fitted values exceeded finite bounds.');}}
 return {id:series.id,label:series.label,origin:series.origin,inputOrigin:asset.provenance.origin,assetId:asset.id,checksum:asset.checksum.value,points,missing,method,uncertainty,interpretation:series.interpretation};
}
export function buildChartModel(input:unknown,assets:readonly ScientificAsset[]):ChartModel{
 const spec=validateStatisticalChart(input),warnings:string[]=[];
 const series=spec.series.map(s=>{const asset=assets.find(a=>a.id===s.assetId);if(!asset||asset.kind!=='table'||!hasCheckedAssetIntegrity(asset))throw Error(`Chart requires checked table ${s.assetId}.`);return extract(s,spec,asset);});
 if(series.reduce((sum,s)=>sum+s.points.length,0)>2000)throw Error('This chart exceeds 2,000 total plotted input rows.');
 const xs=series.flatMap(s=>s.points.flatMap(p=>p.x===null?[]:[p.x]));if(!xs.length)throw Error('No nonmissing x observations are available.');
 function domain(values:number[],axis:StatisticalChart['x'],zero=false):[number,number]{
   if(!values.length)throw Error('No nonmissing observations are available.');
   if(axis.scale==='log'&&values.some(value=>value<=0))throw Error('Logarithmic axes require positive values, including uncertainty endpoints.');
   if(axis.domain){if(values.some(value=>value<axis.domain![0]||value>axis.domain![1]))throw Error('The explicit domain would hide plotted values or uncertainty; widen it explicitly.');if(!Number.isFinite(axis.domain[1]-axis.domain[0])||axis.scale==='log'&&Math.log(axis.domain[1])<=Math.log(axis.domain[0]))throw Error('Axis span cannot be represented safely.');return axis.domain;}
   let lo=Math.min(...values,...(zero?[0]:[])),hi=Math.max(...values,...(zero?[0]:[]));if(lo===hi){if(axis.scale==='log'){lo/=1.1;hi*=1.1;}else{const gap=Math.abs(lo)*.05||1;lo-=gap;hi+=gap;}}if(zero)lo=Math.min(lo,0);if(!Number.isFinite(hi-lo)||hi<=lo||axis.scale==='log'&&Math.log(hi)<=Math.log(lo))throw Error('Axis span cannot be represented safely; rescale the input explicitly.');return [lo,hi];
 }
 const x=domain(xs,spec.x);
 if(spec.kind==='distribution'){
   const bins=spec.bins!,width=(x[1]-x[0])/bins;
   for(const s of series){s.derivation='equal-width-histogram';const original=s.points;const counts=Array.from({length:bins},()=>0);for(const p of s.points)if(p.x!==null)counts[Math.min(bins-1,Math.max(0,Math.floor((p.x-x[0])/width)))]++;
     s.points=counts.map((count,index)=>({id:`${s.id}:bin${index}`,rowId:`bin${index}`,x:x[0]+(index+.5)*width,y:count,lower:null,upper:null,count,binLower:x[0]+index*width,binUpper:x[0]+(index+1)*width,members:original.filter(p=>p.x!==null&&Math.min(bins-1,Math.max(0,Math.floor((p.x-x[0])/width)))===index).map(p=>({rowId:p.rowId,value:p.x!})),replicate:null,pair:null}));
   }
 }
 const ys=series.flatMap(s=>s.points.flatMap(p=>p.y===null?[]:[p.y,...(p.lower===null?[]:[p.lower]),...(p.upper===null?[]:[p.upper])]));
 const y=domain(ys,spec.y,spec.kind==='bar'||spec.kind==='distribution'),comparisons:ChartModel['comparisons']=[];
 if(spec.comparison){const left=series.find(s=>s.id===spec.comparison!.left)!,right=series.find(s=>s.id===spec.comparison!.right)!;
   function index(s:ChartSeries){const pairs=new Map<string|number,ChartPoint>();for(const p of s.points)if(p.pair!==null&&p.y!==null){if(pairs.has(p.pair))throw Error('Paired comparison keys must be unique within each series; do not infer an aggregation.');pairs.set(p.pair,p);}return pairs;}
   const a=index(left),b=index(right);for(const [pair,p]of a){const q=b.get(pair);if(q&&p.y!==null&&q.y!==null){const difference=q.y-p.y;if(!Number.isFinite(difference))throw Error('Paired difference exceeded finite bounds.');comparisons.push({pair,left:p.y,right:q.y,difference});}}
   warnings.push('Paired differences are descriptive arithmetic, not significance or causal effects. Unmatched/missing pairs are omitted explicitly.');
 }
 for(const s of series){if(s.missing)warnings.push(`${s.label}: ${s.missing} missing row(s), never replaced with zero.`);if(s.origin!=='illustrative')warnings.push(`${s.label}: declared ${s.origin}; not independently scientifically verified.`);if(s.method)warnings.push(`${s.label}: descriptive unweighted fit; no confidence, prediction, significance or causal claim.`);}
 return {spec,series,domains:{x,y},comparisons,warnings};
}
export function chartCoordinate(value:number,domain:[number,number],scale:'linear'|'log',start:number,end:number){const transform=scale==='log'?Math.log:(v:number)=>v;return start+(transform(value)-transform(domain[0]))/(transform(domain[1])-transform(domain[0]))*(end-start);}
/** Null rows break lines: never interpolate across missing observations silently. */
export function chartSegments(points:readonly ChartPoint[]){const segments:ChartPoint[][]=[];let current:ChartPoint[]=[];for(const p of points){if(p.x===null||p.y===null){if(current.length)segments.push(current);current=[];}else current.push(p);}if(current.length)segments.push(current);return segments;}
