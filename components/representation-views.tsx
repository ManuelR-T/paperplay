'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { RepresentationPlan } from '@/shared/representations';
import type { SourceDocument } from '@/shared/schema';
import type { ScientificAsset } from '@/shared/scientific-assets';
import type { RepresentationNavigation } from '@/shared/semantic-selections';
import type { SemanticSelectionStore } from '@/lib/interactions/selection-store';
import { applyWidgetNavigation,captureWidgetNavigation } from '@/lib/interactions/widget-selection';
import { bindScientificQuantity } from '@/lib/quantities/convert';
import { buildChartModel } from '@/lib/charts/model';
import { ScientificAssetView } from './scientific-asset-importer';
import { ScientificQuantityView } from './scientific-quantity-view';
import { StatisticalChartView } from './statistical-chart';
import { ComposedSceneView } from './composed-scene';
import { ReasoningGuideView } from './reasoning-guide';
import { DiscreteView } from './discrete-view';
import { MolecularView } from './molecular-view';
import { PhysicalFieldView } from './physical-field-view';
import { StochasticView } from './stochastic-view';
import { DynamicsView } from './dynamics-view';
import { SpatialViewRenderer } from './spatial-view';
import { Button } from './ui/button';
const WidgetView=dynamic(()=>import('./widgets/widget-view').then(module=>module.WidgetView),{ssr:false,loading:()=> <p role="status">Loading figure…</p>});
export type PlanUpdate=(transform:(current:RepresentationPlan)=>RepresentationPlan)=>void;
/** Shared by the in-paper preview and standalone scientific studies; no discipline switch. */
export function RepresentationViews({plan,source,assets,store,navigation,onUpdate,onReturn}:{plan:RepresentationPlan;source:SourceDocument;assets:readonly ScientificAsset[];store:SemanticSelectionStore;navigation:RepresentationNavigation;onUpdate:PlanUpdate;onReturn:(blockId:string)=>void}){
 const returnToAnchor=(id:string)=>onReturn(plan.anchors.find(anchor=>anchor.id===id)!.blockId);
 return <>{plan.views.map(view=>{
   switch(view.kind){
     case 'discrete-trace':return <DiscreteView key={view.id} discrete={view.discrete} viewId={view.id} store={store} navigation={navigation} onReturn={returnToAnchor} onChange={patch=>onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='discrete-trace'?{...item,discrete:{...item.discrete,...patch}}:item)}))}/>;
     case 'molecular-view':return <MolecularView key={view.id} molecule={view.molecule} assets={assets} viewId={view.id} store={store} navigation={navigation} onReturn={returnToAnchor} onChange={patch=>onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='molecular-view'?{...item,molecule:{...item.molecule,...patch}}:item)}))}/>;
     case 'physical-field':return <PhysicalFieldView key={view.id} request={view.field.request} anchorId={view.field.anchorIds[0]} onSource={returnToAnchor} viewId={view.id} store={store} navigation={navigation} onConfigure={request=>onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='physical-field'?{...item,field:{...item.field,request}}:item)}))}/>;
     case 'stochastic':return <StochasticView key={view.id} request={view.stochastic.request} anchorId={view.stochastic.anchorIds[0]} onSource={returnToAnchor} viewId={view.id} store={store} navigation={navigation} onConfigure={request=>onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='stochastic'?{...item,stochastic:{...item.stochastic,request}}:item)}))}/>;
     case 'dynamics':return <DynamicsView key={view.id} request={view.dynamics.request} anchorId={view.dynamics.anchorIds[0]} onSource={returnToAnchor} viewId={view.id} store={store} navigation={navigation} onConfigure={request=>onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='dynamics'?{...item,dynamics:{...item.dynamics,request}}:item)}))}/>;
     case 'reasoning-guide':return <ReasoningGuideView key={view.id} viewId={view.id} guide={view.guide} sourceUrl={source.source.url} store={store} navigation={navigation} onReturn={returnToAnchor}/>;
     case 'spatial-view':return <SpatialViewRenderer key={view.id} viewId={view.id} spatial={view.spatial} assets={assets} store={store} navigation={navigation} onReturn={returnToAnchor} onChange={patch=>onUpdate(current=>({...current,navigation:Object.keys(patch).every(key=>key==='viewport')?current.navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='spatial-view'?{...item,spatial:{...item.spatial,...patch}}:item)}))}/>;
     case 'statistical-chart':return <StatisticalChartView key={view.id} model={buildChartModel(view.chart,assets)} viewId={view.id} store={store} navigation={navigation} onReturn={returnToAnchor} onConfigure={chart=>onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='statistical-chart'?{...item,chart}:item)}))}/>;
     case 'composed-scene':return <ComposedSceneView key={view.id} scene={view.scene} viewId={view.id} store={store} navigation={navigation} onReturn={returnToAnchor}/>;
     case 'asset':return <ScientificAssetView key={view.id} asset={assets.find(asset=>asset.id===view.assetId)!}/>;
     case 'quantity':return <ScientificQuantityView key={view.id} selectedUncertainty={navigation.selections.find(s=>s.kind==='uncertainty'&&s.viewId===view.id)} onSelectUncertainty={(index,mode)=>store.select({kind:'uncertainty',viewId:view.id,scopeId:'quantity',quantityId:view.quantityId,index,mode})} quantity={bindScientificQuantity(plan.quantities.find(quantity=>quantity.id===view.quantityId)!.measurement!,view.requirement)}/>;
     case 'widget':return <WidgetView key={view.id} envelope={applyWidgetNavigation(view.id,view.widget,navigation)} source={source} onSource={()=>onReturn(view.widget.source.blockId)} onChange={widget=>{captureWidgetNavigation(view.id,widget,store);onUpdate(current=>({...current,navigation:undefined,views:current.views.map(item=>item.id===view.id&&item.kind==='widget'?{...item,widget}:item)}));}}/>;
     case 'source-guide':return <SourceGuide key={view.id} view={view} plan={plan} source={source} onReturn={onReturn}/>;
   }
 })}</>;
}
function SourceGuide({plan,view,source,onReturn}:{onReturn:(blockId:string)=>void;plan:RepresentationPlan;view:Extract<RepresentationPlan['views'][number],{kind:'source-guide'}>;source:SourceDocument}){
 const [index,setIndex]=useState(0),step=view.steps[Math.min(index,view.steps.length-1)];
 return <section aria-label="Source reading guide"><div className="reader-choice" role="group" aria-label="Reading guide steps">{view.steps.map((item,i)=><Button key={item.id} aria-pressed={index===i} variant={index===i?'secondary':'outline'} onClick={()=>setIndex(i)}>{i+1}. {item.title}</Button>)}</div><div aria-live="polite"><h3>{step.title}</h3><p>{step.explanation}</p></div>{step.anchorIds.map(id=>{const anchor=plan.anchors.find(anchor=>anchor.id===id)!;return <div key={id}><blockquote className="passage-quotation">{anchor.quote}</blockquote><a href={`#source-${source.id}-${anchor.blockId}`} onClick={event=>{event.preventDefault();onReturn(anchor.blockId);}}>Original source passage · page {anchor.page}</a></div>;})}</section>;
}
