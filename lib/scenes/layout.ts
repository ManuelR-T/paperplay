import { sceneMarks, type ScientificScene, type SceneMark } from '../../shared/composed-scene';
export const sceneSpacing={panel:16,gap:16,tight:8,canvasPadding:32} as const;
/** Shared conservative estimate; HTML labels remain untruncated and wrap using actual browser text layout. */
export function measureSceneText(text:string,fontSize=16,letterSpacing=0){return {width:Array.from(text).length*(fontSize*.65+letterSpacing),lineHeight:fontSize*1.5};}
export function marksAtFrame(scene:ScientificScene,frameIndex:number):SceneMark[]{
 const updates=new Map(scene.frames[frameIndex]?.changes.map(change=>[change.markId,change]));
 return sceneMarks(scene).map(mark=>{const update=updates.get(mark.id);return update?{...mark,x:update.x,y:update.y,visible:update.visible??true,active:update.active}:mark;});
}
/** One viewport for every frame: changing playback never changes the geometry scale. */
export function stableSceneBounds(scene:ScientificScene){
 const marks=[sceneMarks(scene),...scene.frames.map((_,i)=>marksAtFrame(scene,i))].flat();
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const mark of marks){minX=Math.min(minX,mark.x-(mark.width??0)/2);maxX=Math.max(maxX,mark.x+(mark.width??0)/2);minY=Math.min(minY,mark.y-(mark.height??0)/2);maxY=Math.max(maxY,mark.y+(mark.height??0)/2);}
 const width=maxX-minX||1,height=maxY-minY||1;return {minX:minX-width*.1,minY:minY-height*.1,width:width*1.2,height:height*1.2};
}
export function sceneLayout(scene:ScientificScene,frameIndex=-1){
 const bounds=stableSceneBounds(scene),padding=sceneSpacing.canvasPadding,width=560,height=320;
 const scale=Math.min((width-2*padding)/bounds.width,(height-2*padding)/bounds.height);
 const marks=marksAtFrame(scene,frameIndex).map((mark,index)=>({...mark,index:index+1,screenRadius:Math.max(12,measureSceneText(String(index+1),14).width/2+3),screenX:padding+(mark.x-bounds.minX)*scale,screenY:height-padding-(mark.y-bounds.minY)*scale,screenWidth:(mark.width??0)*scale,screenHeight:(mark.height??0)*scale}));
 const collisions:{frame:string;first:string;second:string}[]=[];
 for(let i=0;i<marks.length;i++)for(let j=i+1;j<marks.length;j++){
   const a=marks[i],b=marks[j];if(a.visible&&b.visible&&a.role!=='group-boundary'&&b.role!=='group-boundary'&&Math.abs(a.screenX-b.screenX)<Math.max(a.screenRadius+b.screenRadius,(a.screenWidth+b.screenWidth)/2)&&Math.abs(a.screenY-b.screenY)<Math.max(a.screenRadius+b.screenRadius,(a.screenHeight+b.screenHeight)/2))collisions.push({frame:scene.frames[frameIndex]?.id??'initial',first:a.id,second:b.id});
 }
 return {bounds,width,height,marks,collisions};
}
export function diagnoseScene(scene:ScientificScene){return [-1,...scene.frames.map((_,i)=>i)].flatMap(frame=>sceneLayout(scene,frame).collisions);}

export function directedConnection(a:{screenX:number;screenY:number;screenRadius:number},b:{screenX:number;screenY:number;screenRadius:number}){
 const dx=b.screenX-a.screenX,dy=b.screenY-a.screenY,length=Math.hypot(dx,dy);
 if(length<1e-9){const x=a.screenX,y=a.screenY-a.screenRadius;return {path:`M ${x-5} ${y} C ${x-34} ${y-34}, ${x+34} ${y-34}, ${x+5} ${y}`,head:`${x+5},${y} ${x+6},${y-9} ${x+13},${y-4}`};}
 const ux=dx/length,uy=dy/length,inset=Math.min(b.screenRadius+3,length/3),endX=b.screenX-ux*inset,endY=b.screenY-uy*inset,startX=a.screenX+ux*Math.min(a.screenRadius+2,length/3),startY=a.screenY+uy*Math.min(a.screenRadius+2,length/3);
 return {path:`M ${startX} ${startY} L ${endX} ${endY}`,head:`${endX},${endY} ${endX-ux*8-uy*5},${endY-uy*8+ux*5} ${endX-ux*8+uy*5},${endY-uy*8-ux*5}`};
}
