import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFigureFrame} from '../lib/artifacts/quality-check';
import type {SdkFrame} from '../shared/figure-sdk';
import type {FigureTextBounds} from '../shared/figure-quality';
const text=(id:string,x:number,y:number):SdkFrame['marks'][number]=>({id,kind:'text',at:[x,y],text:id,label:id});
const line=(id:string,from:[number,number],to:[number,number]):SdkFrame['marks'][number]=>({id,kind:'line',from,to,paint:'ink',label:id});
const frame=(marks:SdkFrame['marks']):SdkFrame=>({format:'paperplay-sdk-frame',schemaVersion:1,title:'Legend fixture',description:'Measured layout regression',coordinateSpace:{width:400,height:300},marks,controls:[],table:{caption:'Values',columns:['Value'],rows:[]},state:null});
const inspect=(marks:SdkFrame['marks'],textBounds:FigureTextBounds[])=>inspectFigureFrame(frame(marks),{step:0,textBounds});

test('measured legend swatch crossing the text ink triggers an artifact diagnostic',()=>{
 const found=inspect([line('swatch',[70,100],[95,100]),text('standard',110,100)],[{markIndex:1,x:82,y:92,width:56,height:16}]);
 assert.deepEqual(found,[{code:'legend-overlap',scope:'artifact',step:0,markIndex:1}]);
});
test('histogram annotation overlapping its row label is rejected even when both fit the canvas',()=>{
 const found=inspect([text('tilted',70,180),text('annotation',75,190)],[{markIndex:0,x:45,y:172,width:50,height:16},{markIndex:1,x:15,y:182,width:120,height:16}]);
 assert.deepEqual(found.map(d=>d.code),['text-overlap','text-overlap']);
 assert.deepEqual(found.map(d=>d.markIndex),[0,1]);
});
test('a separated swatch and label with an annotation on its own row pass',()=>{
 assert.deepEqual(inspect([line('swatch',[40,100],[65,100]),text('standard',110,100),text('annotation',110,130)],[{markIndex:1,x:82,y:92,width:56,height:16},{markIndex:2,x:55,y:122,width:110,height:16}]),[]);
});
test('ordinary plot axes and connected curves are not treated as legend swatches',()=>{
 const marks=[line('axis',[20,100],[380,100]),line('curve-1',[70,100],[95,100]),line('curve-2',[95,100],[115,110]),text('label',110,100)];
 assert.deepEqual(inspect(marks,[{markIndex:3,x:82,y:92,width:56,height:16}]),[]);
});
test('touching text bounds and short ticks attached to axes do not cause false overlap failures',()=>{
 const marks=[line('axis',[20,100],[380,100]),line('tick',[90,100],[90,110]),text('left',70,100),text('right',120,100)];
 assert.deepEqual(inspect(marks,[{markIndex:2,x:45,y:92,width:50,height:16},{markIndex:3,x:95,y:92,width:50,height:16}]),[]);
});
test('a short underline outside the text ink core is allowed',()=>{
 assert.deepEqual(inspect([line('underline',[80,108],[130,108]),text('label',105,100)],[{markIndex:1,x:80,y:92,width:50,height:16}]),[]);
});
test('unmeasured text cannot produce guessed overlap diagnostics',()=>{
 assert.deepEqual(inspectFigureFrame(frame([line('swatch',[70,100],[95,100]),text('standard',110,100)]),{step:0}),[]);
});
