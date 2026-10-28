import { createSourceGuide } from './source-guide';
import { validateRepresentationPlan, type RepresentationPlan } from '../../shared/representations';
import type { SourceDocument } from '../../shared/schema';
/** Manual source scaffold; values/positions are reader-authored illustration, not source measurements. */
export function createComposedGuide(source:SourceDocument,blockId:string,title=''):RepresentationPlan{
 const guide=createSourceGuide(source,blockId,title);
 return validateRepresentationPlan({...guide,title:title.trim()||'A composed reading figure',objective:'Inspect the cited passage beside a responsive figure scaffold. All coordinates and values in this example are explicitly illustrative.',interactions:['select-step','return-source'],execution:{kind:'none',capabilities:[{id:'composed-scene',version:'1.0.0'}],assetIds:[]},views:[{id:'composition',kind:'composed-scene',scene:{format:'paperplay-composed-scene',schemaVersion:1,rootId:'root',nodes:[
   {id:'root',kind:'panel',title:'Source and illustration',children:['citation','columns','key']},
   {id:'citation',kind:'annotation',role:'source',text:guide.anchors[0].quote,anchorIds:[guide.anchors[0].id]},
   {id:'columns',kind:'grid',columns:2,children:['concepts','values']},
   {id:'concepts',kind:'scene',title:'Illustrative relationship scaffold',description:'Three generic objects and an authored transition. This is a layout example, not an interpretation or execution of the cited paper.',coordinates:{frame:'authored teaching frame',xAxis:'x',yAxis:'y',unit:'illustrative units'},marks:[{id:'steps',kind:'repeat',label:'Illustrative objects',color:'blue',items:[{id:'first',label:'First illustrative object — replace with a source-grounded concept',x:0,y:0},{id:'second',label:'Second illustrative object — relationship meaning must be declared',x:1,y:1},{id:'third',label:'Third illustrative object — no causal evidence implied',x:2,y:0}]}],relationships:[{id:'relation',from:'first',to:'second',label:'Authored explanatory connection; not established causation'}],frames:[{id:'move',label:'Authored position change',changes:[{markId:'second',x:1,y:2}]}]},
   {id:'values',kind:'slot',slot:'chart',title:'Numerical equivalent slot',description:'Explicit illustrative numbers; a specialized chart adapter can be added later.',values:[{label:'Example input',value:1,unit:'dimensionless illustration'}]},
   {id:'key',kind:'legend',items:[{label:'Blue: authored illustrative objects',color:'blue'}]},
 ]}}]},source);
}
