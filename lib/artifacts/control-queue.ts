import type {SdkEvent} from '../../shared/figure-sdk';
type Control=Extract<SdkEvent,{kind:'control'}>;
/** Stateful SDK steps stay serial; keep each slider's latest requested value while a step runs. */
export function createLatestControlQueue(){
 const values=new Map<string,Control>();
 return {push(event:Control){if(event.value===undefined)return;if(!values.has(event.id)&&values.size>=16)values.delete(values.keys().next().value!);values.set(event.id,event);},take(){const next=values.entries().next();if(next.done)return;values.delete(next.value[0]);return next.value[1];},clear(){values.clear();}};
}
