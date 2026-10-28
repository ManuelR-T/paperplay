import type { RepresentationPlan } from '../../shared/representations';
import type { StatisticalChart } from '../../shared/statistical-charts';

export function reformatChartRepresentation(plan:RepresentationPlan,kind:StatisticalChart['kind']):RepresentationPlan{
 const view=plan.views[0];if(view.kind!=='statistical-chart')throw Error('Expected chart example.');const base=view.chart;if(kind===base.kind)return plan;
 if(kind!=='distribution')return {...plan,navigation:undefined,views:[{...view,chart:{...base,kind}}]};
 const first=base.series.filter(series=>series.origin==='observed');
 return {...plan,navigation:undefined,execution:{...plan.execution,assetIds:[...new Set(first.map(series=>series.assetId))]},views:[{...view,chart:{...base,kind,bins:6,title:'Distribution of supplied observation summaries — counts, not raw replicate inference',x:{...base.y,label:'Supplied observed summary value'},y:{label:'Number of supplied summary values',unit:'count',scale:'linear'},comparison:undefined,series:first.map(series=>({...series,xColumn:series.yColumn!,yColumn:undefined,fit:undefined,uncertainty:undefined,interpretation:series.interpretation+' Histogram counts summary rows, not independent plants/days.'}))}}]};
}
