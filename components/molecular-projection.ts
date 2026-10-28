export type Coordinate3=readonly[number,number,number];
export type MolecularCamera={projection:'3d'|'xy'|'xz'|'yz';rotation:readonly[number,number,number];zoom:number;clipNear:number;clipFar:number};
export type ProjectedMolecularPoint={index:number;x:number;y:number;depth:number;visible:boolean};
/** Trusted presentation math only. It neither changes coordinates nor defines molecular measurements. */
export function projectMolecularPoints(coordinates:readonly Coordinate3[],camera:MolecularCamera):ProjectedMolecularPoint[]{
 if(!coordinates.length||coordinates.length>512||coordinates.some(point=>point.length!==3||point.some(value=>!Number.isFinite(value))))throw Error('Coordinate projection requires one to 512 finite three-dimensional points.');
 if(!['3d','xy','xz','yz'].includes(camera.projection)||![...camera.rotation,camera.zoom,camera.clipNear,camera.clipFar].every(Number.isFinite)||camera.zoom<=0||camera.zoom>8||camera.clipNear< -1||camera.clipFar>1||camera.clipNear>camera.clipFar)throw Error('The coordinate camera is outside the supported display bounds.');
 const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];for(const point of coordinates)point.forEach((value,axis)=>{minimum[axis]=Math.min(minimum[axis],value);maximum[axis]=Math.max(maximum[axis],value);});
 const center=minimum.map((value,axis)=>value/2+maximum[axis]/2),shifted=coordinates.map(point=>point.map((value,axis)=>value-center[axis]));
 let radius=0;for(const point of shifted)radius=Math.max(radius,Math.hypot(...point));if(!Number.isFinite(radius))throw Error('The coordinate extent needs explicit rescaling before display.');if(radius===0)radius=1;
 const [rx,ry,rz]=camera.rotation.map(angle=>angle*Math.PI/180),cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz),scale=175*camera.zoom/radius;
 return shifted.map((point,index)=>{const [x,y,z]=point;let horizontal:number,vertical:number,depth:number;
  if(camera.projection==='xy'){horizontal=x;vertical=y;depth=z;}else if(camera.projection==='xz'){horizontal=x;vertical=z;depth=y;}else if(camera.projection==='yz'){horizontal=y;vertical=z;depth=x;}else{const y1=cx*y-sx*z,z1=sx*y+cx*z,x2=cy*x+sy*z1;depth=-sy*x+cy*z1;horizontal=cz*x2-sz*y1;vertical=sz*x2+cz*y1;}
  const normalizedDepth=depth/radius,px=360+horizontal*scale,py=220-vertical*scale;if(![px,py,normalizedDepth].every(Number.isFinite))throw Error('Projected coordinate values exceeded finite display bounds.');return {index,x:px,y:py,depth:normalizedDepth,visible:normalizedDepth>=camera.clipNear&&normalizedDepth<=camera.clipFar};
 });
}
