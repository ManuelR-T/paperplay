import parserSource from 'paperplay:acorn-source';
import { compileFigureSource } from './compiler-engine';
let accepted=false;
self.onmessage=async event=>{if(accepted)return;accepted=true;const input=event.data;if(!input||typeof input!=='object'||typeof input.instanceId!=='string'||Object.keys(input).some(key=>!['instanceId','request'].includes(key)))return;
 if(new TextEncoder().encode(JSON.stringify(input)).length>70*1024){self.postMessage({instanceId:input.instanceId,result:{status:'rejected',diagnostics:[{code:'integrity',message:'Compiler request exceeds its input budget.'}]}});return;}
 try{self.postMessage({instanceId:input.instanceId,result:await compileFigureSource(input.request,parserSource)});}catch{self.postMessage({instanceId:input.instanceId,result:{status:'failed',diagnostics:[{code:'resource',message:'Isolated compiler failed within its policy.'}]}});}
};
