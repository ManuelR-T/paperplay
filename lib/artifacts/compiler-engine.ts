import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import { newQuickJSWASMModuleFromVariant,newVariant,DefaultIntrinsics } from 'quickjs-emscripten-core';
import { compileRequestSchema,compiledFigureSchema,canonicalArtifactJson,type FigureCompileResult,type CompileDiagnostic } from '../../shared/figure-compilation';
import { FIGURE_SDK_SOURCE,sha256Text } from './sdk-source';
export const ACORN_SOURCE_SHA256='b95392d79457d0357555c5ed3e56302d074b92dff119bcf3b44179500b10e9df';
const policy={maxSourceBytes:65536,maxAstNodes:8192,maxAstDepth:96,maxWasmBytes:67108864,maxHeapBytes:33554432,maxStackBytes:524288,maxWorkMs:1000} as const;
const messages={syntax:'The script has invalid syntax.',entry:'Define one synchronous update function with three simple parameters.',dependency:'Imports and module loaders are not supported.', 'unsupported-syntax':'Use synchronous script functions without async/generator/module syntax.',complexity:'The source exceeds the permitted syntax complexity.',resource:'Compilation exceeded the resource policy.',integrity:'Source, SDK or parser integrity differs.',cancelled:'Compilation cancelled.',unavailable:'Isolated compilation is unavailable.'} as const;
const rejected=(code:CompileDiagnostic['code'],position?:number):FigureCompileResult=>({status:'rejected',diagnostics:[{code,message:messages[code],...(Number.isInteger(position)&&position!>=0&&position!<=65536?{position}:{})}]});
const WALKER=`(function(){
 let ast;try{ast=acorn.parse(__artifactSource,{ecmaVersion:2022,sourceType:'script'});}catch(error){return JSON.stringify({code:'syntax',position:error.pos});}
 const main=ast.body[0];if(ast.body.length!==1||!main||main.type!=='FunctionDeclaration'||main.id.name!=='update'||main.params.length!==3||main.params.some(p=>p.type!=='Identifier'))return JSON.stringify({code:'entry'});
 const queue=[{node:ast,depth:0}];let count=0;
 while(queue.length){const current=queue.pop(),node=current.node;if(++count>8192||current.depth>96)return JSON.stringify({code:'complexity',position:node.start});
 if(node.type==='ImportExpression'||node.type==='ImportDeclaration'||node.type.startsWith('Export')||node.type==='MetaProperty'||node.type==='Identifier'&&['require','importScripts','module','exports'].includes(node.name))return JSON.stringify({code:'dependency',position:node.start});
 if(node.async||node.generator||node.type==='AwaitExpression'||node.type==='YieldExpression')return JSON.stringify({code:'unsupported-syntax',position:node.start});
 for(const key of Object.keys(node)){const value=node[key];if(Array.isArray(value)){for(const item of value)if(item&&typeof item==='object'&&typeof item.type==='string')queue.push({node:item,depth:current.depth+1});}else if(value&&typeof value==='object'&&typeof value.type==='string')queue.push({node:value,depth:current.depth+1});}
 }return JSON.stringify({code:'accepted'});
})()`;
/** Called only in the disposable compiler Worker or isolated reference tests. Artifact source is never run. */
export async function compileFigureSource(input:unknown,parserSource:string):Promise<FigureCompileResult>{
 const parsed=compileRequestSchema.safeParse(input);if(!parsed.success)return rejected('integrity');const request=parsed.data;
 if(new TextEncoder().encode(request.source).length>policy.maxSourceBytes||await sha256Text(request.source)!==request.sourceSha256||await sha256Text(FIGURE_SDK_SOURCE)!==request.sdkSha256||await sha256Text(parserSource)!==ACORN_SOURCE_SHA256)return rejected('integrity');
 const quickjs=await newQuickJSWASMModuleFromVariant(newVariant(variant,{wasmMemory:new WebAssembly.Memory({initial:256,maximum:policy.maxWasmBytes/65536})})),deadline=Date.now()+policy.maxWorkMs;
 function runtime(){const value=quickjs.newRuntime();value.setMemoryLimit(policy.maxHeapBytes);value.setMaxStackSize(policy.maxStackBytes);value.setInterruptHandler(()=>Date.now()>deadline);return value;}
 const parserRuntime=runtime(),parser=parserRuntime.newContext({intrinsics:{...DefaultIntrinsics,Promise:false,Date:false,Proxy:false}});
 try{
   const setup=parser.evalCode(parserSource,'trusted-parser.js',{type:'global',strict:false});if(setup.error){setup.error.dispose();return rejected('resource');}setup.value.dispose();
   const sourceHandle=parser.newString(request.source);try{parser.setProp(parser.global,'__artifactSource',sourceHandle);}finally{sourceHandle.dispose();}
   const analysis=parser.evalCode(WALKER,'trusted-policy.js',{type:'global',strict:true});if(analysis.error){analysis.error.dispose();return rejected('resource');}
   try{const json=parser.getString(analysis.value);if(json.length>1024)return rejected('resource');const result=JSON.parse(json);if(result.code!=='accepted')return rejected(Object.hasOwn(messages,result.code)?result.code:'resource',result.position);}finally{analysis.value.dispose();}
 }catch{return rejected('resource');}finally{parser.dispose();parserRuntime.dispose();}
 const compilerRuntime=runtime(),compiler=compilerRuntime.newContext();
 try{const compiled=compiler.evalCode(request.source,'artifact.js',{type:'global',strict:true,compileOnly:true});if(compiled.error){compiled.error.dispose();return rejected('syntax');}compiled.value.dispose();}catch{return rejected('resource');}finally{compiler.dispose();compilerRuntime.dispose();}
 const artifact=compiledFigureSchema.parse({format:'paperplay-compiled-figure',schemaVersion:1,manifestSha256:request.manifestSha256,entry:{file:'figure.js',symbol:'update',source:request.source,sha256:request.sourceSha256},sdk:{version:'1.0.0',sha256:request.sdkSha256},toolchain:{compiler:'paperplay-script-admission@1.0.0',parser:'acorn@8.19.0',parserSha256:ACORN_SOURCE_SHA256,engine:'quickjs-emscripten@0.32.0-singlefile-browser-release-sync',engineModuleSha256:'49c171aa6ee9c782f40229c95cdfaeb282b6740dd8eea4cc8e655986276a766a',grammar:'ecmascript-2022-script',policy:'synchronous-update-v1'},policy,dependencies:[],admission:'syntax-and-policy-only',scientificEvidence:'unverified'});
 return {status:'ready',artifact,sha256:await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(artifact)),diagnostics:[]};
}
