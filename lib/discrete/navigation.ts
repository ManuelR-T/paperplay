import { discreteFrameEntityIds,type DiscreteResult } from '../../shared/discrete-algorithms';
import type { SemanticSelection } from '../../shared/semantic-selections';

/** A syntactically valid saved step is admitted only after its exact trace exists. */
export function validateDiscreteNavigation(result:DiscreteResult,selections:readonly SemanticSelection[],viewId:string){
 const relevant=selections.filter(value=>value.viewId===viewId);
 if(relevant.some(value=>value.scopeId!=='discrete'||value.kind!=='time'&&value.kind!=='entity'))throw Error('Saved discrete navigation has an unsupported channel.');
 const time=relevant.find(value=>value.kind==='time');
 if(time?.kind==='time'&&(time.mode!=='authored-step'||time.unit!=='frame'||time.frameId!==null||!Number.isInteger(time.value)||!result.frames[time.value]))throw Error('The saved discrete step is not in the retained trace.');
 const frame=result.frames[time?.kind==='time'?time.value:0],available=new Set(frame?discreteFrameEntityIds(frame,result.request):[]);
 if(relevant.some(value=>value.kind==='entity'&&!available.has(value.entityId)))throw Error('The saved entity is unavailable at the selected discrete step. Rewind and creation do not share an entity universe.');
 return frame??null;
}
