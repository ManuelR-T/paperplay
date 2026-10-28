import { representationNavigationSchema, semanticSelectionSchema, selectionChannel, type RepresentationNavigation, type SemanticSelection } from '../../shared/semantic-selections';
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function createSemanticSelectionStore({revision,initial,isValid,onLimit}:{onLimit?:(message:string)=>void;revision:string;initial?:RepresentationNavigation;isValid:(value:SemanticSelection)=>boolean}){
 let validate=isValid;
 let state=freeze(representationNavigationSchema.parse(initial??{format:'paperplay-semantic-navigation',schemaVersion:1,revision,selections:[]}));
 if(state.revision!==revision||state.selections.some(value=>!validate(value)))throw Error('Saved selections do not match the current inputs.');
 const history:RepresentationNavigation[]=[];const listeners=new Set<()=>void>();
 function apply(next:RepresentationNavigation,remember=true){
   if(JSON.stringify(next)===JSON.stringify(state))return false;
   if(next.selections.length>32){onLimit?.('This figure already retains 32 selection channels. Clear selections before adding another; current selections were kept.');return false;}
   const checked=representationNavigationSchema.parse(next);onLimit?.('');
   if(remember){history.push(state);if(history.length>32)history.shift();}
   state=freeze(checked);for(const notify of [...listeners])notify();return true;
 }
 return Object.freeze({canUndo:()=>history.length>0,getSnapshot:()=>state,subscribe:(notify:()=>void)=>{listeners.add(notify);return()=>{listeners.delete(notify);};},
   select(value:SemanticSelection){const selection=semanticSelectionSchema.parse(value);if(!validate(selection))throw Error('Selection is unavailable for these inputs.');const channel=selectionChannel(selection);if(state.selections.some(s=>selectionChannel(s)===channel&&JSON.stringify(s)===JSON.stringify(selection)))return false;return apply({...state,selections:[...state.selections.filter(s=>selectionChannel(s)!==channel),selection]});},
   replaceScope(viewId:string,scopeId:string,values:SemanticSelection[]){
     const parsed=values.map(value=>semanticSelectionSchema.parse(value));
     if(parsed.some(value=>value.viewId!==viewId||value.scopeId!==scopeId||!validate(value))||new Set(parsed.map(selectionChannel)).size!==parsed.length)throw Error('Invalid semantic scope transaction.');
     const previous=state.selections.filter(value=>value.viewId===viewId&&value.scopeId===scopeId);
     if(previous.length===parsed.length&&parsed.every(value=>previous.some(old=>JSON.stringify(old)===JSON.stringify(value))))return false;
     return apply({...state,selections:[...state.selections.filter(value=>value.viewId!==viewId||value.scopeId!==scopeId),...parsed]});
   },
   clearChannel(viewId:string,scopeId:string,kind:SemanticSelection['kind']){return apply({...state,selections:state.selections.filter(s=>!(s.viewId===viewId&&s.scopeId===scopeId&&s.kind===kind))});},
   clear(viewId?:string){return apply({...state,selections:state.selections.filter(s=>viewId&&s.viewId!==viewId)});},
   resetFrames(viewId:string,scopeId:string){return apply({...state,selections:state.selections.filter(s=>!(s.kind==='time'&&s.viewId===viewId&&s.scopeId===scopeId))});},
   undo(){const previous=history.pop();return previous?apply(previous,false):false;},
   rebindInputs(nextRevision:string,nextValidate:(value:SemanticSelection)=>boolean){validate=nextValidate;if(nextRevision===state.revision)return false;history.length=0;return apply({...state,revision:nextRevision,selections:state.selections.filter(validate)},false);},
 });
}
export type SemanticSelectionStore=ReturnType<typeof createSemanticSelectionStore>;
