import type { WidgetEnvelope } from '../../shared/widgets';
import type { RepresentationNavigation, SemanticSelection } from '../../shared/semantic-selections';
import type { SemanticSelectionStore } from './selection-store';
export function captureWidgetNavigation(viewId:string,widget:WidgetEnvelope,store:SemanticSelectionStore){
 const base={viewId,scopeId:'widget'};
 const selection=widget.view.selection;
 const spec=widget.spec,parameterId=selection.slice(7);
 const declaredParameter=(spec.kind==='equation'||spec.kind==='function')&&spec.variables.some(variable=>variable.name===parameterId)||spec.kind==='custom'&&spec.parameters.some(parameter=>parameter.name===parameterId);
 const values:SemanticSelection[]=[{...base,kind:'time',frameId:null,value:widget.view.step,unit:'widget-step',mode:'authored-step'}];
 if(selection.startsWith('symbol:')&&declaredParameter)values.push({...base,kind:'parameter',parameterId});
 if(selection)values.push({...base,kind:'entity',entityId:selection});
 store.replaceScope(viewId,'widget',values);
}
export function applyWidgetNavigation(viewId:string,widget:WidgetEnvelope,navigation:RepresentationNavigation):WidgetEnvelope{
 const entity=navigation.selections.find(s=>s.viewId===viewId&&s.kind==='entity'),time=navigation.selections.find(s=>s.viewId===viewId&&s.kind==='time');
 return {...widget,view:{...widget.view,selection:entity?.kind==='entity'?entity.entityId:'',step:time?.kind==='time'?time.value:0}};
}
