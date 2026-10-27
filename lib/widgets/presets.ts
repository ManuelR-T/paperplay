import { validateDocument, type SourceDocument } from '../../shared/schema';
import { validateWidgetEnvelope, type WidgetKind, type WidgetEnvelope, type WidgetSpec, type Expression } from '../../shared/widgets';
import { getWidgetDescriptor } from './catalog';
const value=(value:number):Expression=>({op:'number',value});const variable=(name:string):Expression=>({op:'variable',name});
const quadratic:Expression={op:'sub',left:{op:'mul',left:{op:'mul',left:value(0.5),right:variable('a')},right:{op:'pow',left:variable('x'),right:value(2)}},right:{op:'mul',left:variable('b'),right:variable('x')}};
const vars=()=>[{name:'a',value:2,min:0.1,max:8,step:0.1,definition:'Scalar curvature for the one-dimensional quadratic teaching model.',sourceSymbol:'A (one-dimensional restriction)',unit:'scalar' as const},{name:'b',value:1,min:-5,max:5,step:0.1,definition:'Linear coefficient in the same one-dimensional teaching model.',sourceSymbol:'b',unit:'scalar' as const},{name:'x',value:1,min:-4,max:4,step:0.1,definition:'The scalar argument, restricting the source vector to one dimension.',sourceSymbol:'w (one-dimensional restriction)',unit:'scalar' as const}];
const mapping='Authored synthetic teaching data. Inspect its assumptions against the cited passage; these values are not measurements reported by the source.';
export function createWidgetPreset(kind:WidgetKind):WidgetSpec {
 switch(kind){
  case'equation':return {kind,expression:structuredClone(quadratic),variables:vars(),resultLabel:'Quadratic objective',mapping};
  case'function':return {kind,expression:structuredClone(quadratic),variables:vars(),xVariable:'x',domain:[-4,4],samples:97,probe:1,derivative:true,mapping};
  case'diagram':return {kind,nodes:[{id:'source',label:'Read the source',x:15,y:50},{id:'model',label:'State the model',x:50,y:50},{id:'inspect',label:'Inspect assumptions',x:85,y:50}],edges:[{id:'source-model',source:'source',target:'model',label:'motivates',weight:1},{id:'model-inspect',source:'model',target:'inspect',label:'must be checked against',weight:1}],steps:[{label:'Source',description:'Read the quoted passage before interpreting the added diagram.',activeNodeIds:['source']},{label:'Model',description:'Identify explicit inputs and the model used by the teaching figure.',activeNodeIds:['model']},{label:'Inspect',description:'Compare assumptions and omissions with the original text. These are authored conceptual steps, not execution.',activeNodeIds:['inspect']}],mapping};
  case'table':return {kind,columns:[{id:'input',label:'Synthetic input',unit:'arbitrary units'},{id:'value',label:'Declared teaching value',unit:'arbitrary units'}],rows:[{id:'row1',cells:{input:1,value:2}},{id:'row2',cells:{input:2,value:4}},{id:'row3',cells:{input:3,value:6}}],provenance:'illustrative',mapping};
  case'linear':return {kind,matrix:[[1,0.5],[0,2]],vector:[1,1],mapping};
  case'probability':return {kind,distribution:'beta-bernoulli',probability:0.4,trials:10,mean:0,deviation:1,alpha:2,beta:2,successes:6,failures:2,samples:256,mapping};
  case'attention':return {kind,queries:[[1,0],[0,1]],keys:[[1,0],[0,1]],values:[[1,0],[0,2]],mask:[],temperature:1,mapping};
  case'graph':return {kind,mode:'graph',directed:false,nodes:[{id:'a',label:'A',x:15,y:50},{id:'b',label:'B',x:50,y:20},{id:'c',label:'C',x:85,y:50}],edges:[{id:'ab',source:'a',target:'b',label:'2',weight:2},{id:'bc',source:'b',target:'c',label:'1',weight:1},{id:'ac',source:'a',target:'c',label:'5',weight:5}],start:'a',target:'c',rows:5,columns:5,blocked:[],mapping};
  case'signal':return {kind,mode:'1d',input:[[0,0,1,0,0,0,0,0]],kernel:[[1,2,1]],boundary:'zero',stride:1,normalize:false,mapping};
 }
}
export function createWidgetForSource(kind:WidgetKind,source:SourceDocument,blockId?:string):WidgetEnvelope {
 const doc=validateDocument(source);const suggested=(kind==='equation'||kind==='function'||kind==='linear')?doc.blocks.find(b=>b.kind==='equation'&&/f\(w\)|quadratic/i.test(b.latex)):undefined;
 const block=doc.blocks.find(b=>b.id===blockId)??suggested??doc.blocks.find(b=>b.kind!=='heading')??doc.blocks[0];
 if(blockId&&!doc.blocks.some(b=>b.id===blockId))throw Error('The selected source block no longer exists.');
 const quote=(block.kind==='equation'?block.latex:block.kind==='original-figure'?block.caption:block.text).slice(0,500);const spec=createWidgetPreset(kind);
 if((kind==='equation'||kind==='function')&&block.kind==='equation'&&/f\(w\).*Aw/.test(block.latex))spec.mapping='Authored one-dimensional restriction of f(w)=½wᵀAw−bᵀw: a replaces scalar A, x replaces scalar w, and b retains the linear coefficient. The source permits general vectors; this teaching restriction does not reproduce its experiments.';
 return validateWidgetEnvelope({format:'paperplay-widget',schemaVersion:2,id:`widget-${kind}-${block.id}`.replace(/[^A-Za-z0-9_-]/g,'-').slice(0,40),title:getWidgetDescriptor(kind).label,source:{documentId:doc.id,sourceVersion:doc.sourceVersion,blockId:block.id,page:block.page,quote,citation:{title:doc.title,authors:doc.authors,...(doc.source.url?{url:doc.source.url}:{})}},spec,seed:42},doc);
}
