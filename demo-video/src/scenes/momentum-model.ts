export type MomentumPoint={x:number;y:number;vx:number;vy:number;loss:number};
/** Heavy-ball momentum on f(x,y) = (0.06 x² + y²)/2. */
export function momentumTrace(beta:number,steps=64):MomentumPoint[]{
 let x=4.2,y=1,vx=0,vy=0;
 const out:MomentumPoint[]=[{x,y,vx,vy,loss:(.06*x*x+y*y)/2}];
 for(let step=0;step<steps;step++){
  vx=beta*vx-.25*.06*x;vy=beta*vy-.25*y;x+=vx;y+=vy;
  out.push({x,y,vx,vy,loss:(.06*x*x+y*y)/2});
 }
 return out;
}
