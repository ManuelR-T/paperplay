'use client';
/** Browser geometry belongs to the trusted host. Generated code receives none of these handles. */
export type TextInkBounds={left:number;top:number;right:number;bottom:number};
export function createSdkTextMeasurer(reference:Element=document.body){
 const namespace='http://www.w3.org/2000/svg',svg=document.createElementNS(namespace,'svg'),text=document.createElementNS(namespace,'text'),font=getComputedStyle(reference),cache=new Map<string,TextInkBounds>();
 svg.setAttribute('aria-hidden','true');svg.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:visible;visibility:hidden;pointer-events:none';
 text.setAttribute('x','0');text.setAttribute('y','0');text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');text.setAttribute('font-size','1rem');text.setAttribute('font-family',font.fontFamily);text.style.fontWeight=font.fontWeight;text.style.letterSpacing=font.letterSpacing;svg.append(text);document.body.append(svg);
 let disposed=false;
 return {measure(value:string):TextInkBounds{if(disposed||value.length>300)throw Error('Text measurement is unavailable.');const known=cache.get(value);if(known)return known;text.textContent=value;const box=text.getBBox();const bounds={left:box.x,top:box.y,right:box.x+box.width,bottom:box.y+box.height};if(!Object.values(bounds).every(Number.isFinite))throw Error('Text measurement is unavailable.');if(cache.size<512)cache.set(value,bounds);return bounds;},dispose(){disposed=true;cache.clear();svg.remove();}};
}
export type DomQualityIssue={code:'page-overflow'|'small-target'|'keyboard-unreachable'|'low-contrast'|'missing-host-controls'|'unexpected-motion';index?:number};
function visible(element:Element){const style=getComputedStyle(element),box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;}
const colorCache=new Map<string,number[]>();
let colorContext:CanvasRenderingContext2D|null|undefined;
function rgb(value:string):number[]|null{
 const cached=colorCache.get(value);if(cached)return cached;
 if(colorContext===undefined){const canvas=document.createElement('canvas');canvas.width=canvas.height=1;colorContext=canvas.getContext('2d',{willReadFrequently:true});}
 if(!colorContext||!CSS.supports('color',value))return null;
 colorContext.clearRect(0,0,1,1);colorContext.fillStyle='rgba(0,0,0,0)';colorContext.fillStyle=value;colorContext.fillRect(0,0,1,1);
 const pixel=colorContext.getImageData(0,0,1,1).data,result=[pixel[0],pixel[1],pixel[2],pixel[3]/255];if(colorCache.size<256)colorCache.set(value,result);return result;
}
function composite(front:readonly number[],back:readonly number[]){const alpha=front[3]??1;return front.slice(0,3).map((value,index)=>value*alpha+back[index]*(1-alpha));}
function background(element:Element|null):number[]{const layers:Element[]=[];while(element){layers.unshift(element);element=element.parentElement;}let result=[255,255,255];for(const layer of layers){const color=rgb(getComputedStyle(layer).backgroundColor);if(color)result=composite(color,result);}return result;}
export function contrastRatio(foreground:readonly number[],background:readonly number[]){const luminance=(color:readonly number[])=>color.slice(0,3).map(channel=>{const normalized=channel/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
/** Target and keyboard checks are DOM inspections, not a replacement for actual native-browser key actions. */
export function auditGeneratedDom(root:HTMLElement,options:{requireHostControls?:boolean}={}){
 const issues:DomQualityIssue[]=[],targets=[...root.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[role=button]')].filter(visible);
 if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1)issues.push({code:'page-overflow'});
 targets.forEach((target,index)=>{const box=target.getBoundingClientRect();if(box.width<44||box.height<44)issues.push({code:'small-target',index});if(target.matches(':disabled')||target.getAttribute('aria-disabled')==='true')return;if(target.tabIndex<0||target.closest('[inert]'))issues.push({code:'keyboard-unreachable',index});const style=getComputedStyle(target),color=rgb(style.color);if(color&&contrastRatio(composite(color,background(target)),background(target))<4.5)issues.push({code:'low-contrast',index});});
 if(options.requireHostControls&&!root.querySelector('[data-figure-host-controls]'))issues.push({code:'missing-host-controls'});
 if(matchMedia('(prefers-reduced-motion: reduce)').matches&&root.getAnimations({subtree:true}).some(animation=>animation.playState==='running'&&animation.effect?.getComputedTiming().iterations===Infinity))issues.push({code:'unexpected-motion'});
 return {issues,targetCount:targets.length,viewport:{width:innerWidth,height:innerHeight},reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
}

import type { SdkFrame } from '../../shared/figure-sdk';
import type { FigureQualityDiagnostic,FigureQualityViewport,FigureTextBounds } from '../../shared/figure-quality';
/** Inspect the committed production renderer, with no source strings copied into diagnostics. */
export function measureFigureFrameDom(root:HTMLElement,frame:SdkFrame,context:{step:number;viewport?:FigureQualityViewport}){
 const textBounds:FigureTextBounds[]=[],diagnostics:FigureQualityDiagnostic[]=[],step=Math.max(0,Math.min(11,context.step));
 frame.marks.forEach((mark,markIndex)=>{if(mark.kind!=='text')return;const text=root.querySelector<SVGGraphicsElement>(`[data-figure-mark-index="${markIndex}"] text`);try{if(!text)throw Error();const box=text.getBBox();if(![box.x,box.y,box.width,box.height].every(Number.isFinite))throw Error();textBounds.push({markIndex,x:box.x,y:box.y,width:box.width,height:box.height});}catch{diagnostics.push({code:'missing-text-measurement',scope:'host',step,markIndex,...(context.viewport?{viewport:context.viewport}:{})});}});
 const audit=auditGeneratedDom(root,{requireHostControls:true});
 for(const issue of audit.issues)diagnostics.push({code:issue.code,scope:'host',step,...(context.viewport?{viewport:context.viewport}:{})});
 return {textBounds,diagnostics:diagnostics.slice(0,32)};
}
