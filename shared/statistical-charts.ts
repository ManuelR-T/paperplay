import { z } from 'zod';
import { name,text } from './widget-primitives';
const axis=z.strictObject({label:text.max(160),unit:text.max(80),scale:z.enum(['linear','log']),domain:z.tuple([z.number().finite(),z.number().finite()]).optional()});
const uncertainty=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.enum(['standard-deviation','standard-error','source-uncertainty']),column:name,interpretation:text.max(500)}),
 z.strictObject({kind:z.enum(['confidence-interval','credible-interval','range']),lowerColumn:name,upperColumn:name,coverage:z.number().positive().lt(1).optional(),interpretation:text.max(500)}),
]);
export const statisticalChartSchema=z.strictObject({id:name,title:text.max(200),kind:z.enum(['line','scatter','bar','distribution']),anchorIds:z.array(name).min(1).max(8),x:axis,y:axis,bins:z.number().int().min(3).max(30).optional(),
 series:z.array(z.strictObject({id:name,label:text.max(200),assetId:name,xColumn:name,yColumn:name.optional(),origin:z.enum(['observed','processed','fitted','illustrative']),interpretation:text.max(500),order:z.enum(['source','ascending']),fit:z.literal('ordinary-least-squares').optional(),filter:z.strictObject({column:name,equals:z.union([z.string().max(500),z.number().finite()])}).optional(),replicateColumn:name.optional(),sampleCountColumn:name.optional(),uncertainty:uncertainty.optional()})).min(1).max(8),
 comparison:z.strictObject({left:name,right:name,pairColumn:name,interpretation:text.max(500)}).optional(),
});
export type StatisticalChart=z.infer<typeof statisticalChartSchema>;
export type StatisticalSeries=StatisticalChart['series'][number];
export function validateStatisticalChart(input:unknown){
 const chart=statisticalChartSchema.parse(input);
 if(new Set(chart.series.map(s=>s.id)).size!==chart.series.length)throw Error('Chart series IDs must be unique.');
 for(const axis of [chart.x,chart.y])if(axis.domain&&(axis.domain[0]>=axis.domain[1]||axis.scale==='log'&&axis.domain[0]<=0))throw Error('Chart domains must increase and log domains must be positive.');
 if((chart.kind==='bar'||chart.kind==='distribution')&&(chart.y.scale==='log'||chart.y.domain&&!(chart.y.domain[0]<=0&&chart.y.domain[1]>=0)))throw Error('Bars require a linear y axis including zero.');
 for(const series of chart.series){
   if((series.origin==='fitted')!==(series.fit==='ordinary-least-squares'))throw Error('Fitted series require the explicit local least-squares method; other series cannot silently fit observations.');
   if(chart.kind==='distribution'&&(series.yColumn||series.uncertainty||series.fit))throw Error('Distributions use x observations only; no uncertainty or fit is inferred for bins.');
   if(chart.kind!=='distribution'&&!series.yColumn)throw Error('This chart requires a y column.');
   if(series.fit&&series.uncertainty)throw Error('A descriptive fitted curve does not inherit observation uncertainty.');
   if(series.uncertainty&&'coverage'in series.uncertainty&&series.uncertainty.kind==='range'&&series.uncertainty.coverage!==undefined)throw Error('A range has no inferred coverage probability.');
 }
 if(chart.kind==='distribution'&&(!chart.bins||chart.y.unit!=='count'||chart.y.scale!=='linear'))throw Error('Distributions need declared bins and linear count units.');
 if(chart.comparison&&(!chart.series.some(s=>s.id===chart.comparison!.left)||!chart.series.some(s=>s.id===chart.comparison!.right)||chart.comparison.left===chart.comparison.right||chart.kind==='distribution'))throw Error('A paired comparison needs two distinct plotted series.');
 return chart;
}
