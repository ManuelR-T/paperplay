import {useCurrentFrame} from 'remotion';
import {Stage} from '../components';
import {C,FPS,sans,serif,seconds} from '../theme';
import {momentumTrace} from './momentum-model';
import {momentumTimeline} from './momentum-timeline';

export const MOMENTUM_DURATION=seconds(26);
const xy=(x:number,y:number)=>[530+x*91,230-y*156] as const;
export function Momentum(){
 const t=useCurrentFrame()/FPS;
 const {beta,progress,dragging}=momentumTimeline(t);
 const trace=momentumTrace(beta),step=Math.floor(progress),fraction=progress-step;
 const a=trace[step],b=trace[Math.min(64,step+1)];
 const x=a.x+(b.x-a.x)*fraction,y=a.y+(b.y-a.y)*fraction;
 const [cx,cy]=xy(x,y),vx=a.vx+(b.vx-a.vx)*fraction,vy=a.vy+(b.vy-a.vy)*fraction;
 const speed=Math.hypot(vx*91,vy*156),arrowScale=Math.min(3,80/Math.max(speed,.001));
 const points=[...trace.slice(0,step+1).map(p=>xy(p.x,p.y)),[cx,cy]];
 const color=beta>.9?'#ae653e':C.olive;
 const reduction=Math.max(0,Math.min(1,1-(.06*x*x+y*y)/(2*trace[0].loss)));
 const label=dragging?'Same step count. Different memory.':beta<.1?'Every step starts fresh.':beta<.9?'Velocity builds along the valley.':'Longer memory carries the overshoot.';
 const detail=dragging?'Watch the path reshape as β moves through every value.':beta<.1?'With β = 0, each update follows only the current gradient.':beta<.9?'Past updates keep pushing along the shallow direction.':'Past velocity can carry the point past the minimum before it turns back.';
 const sliderX=1244,sliderY=459,sliderWidth=500,thumb=sliderX+sliderWidth*beta/.99;
 return <Stage>
  <div style={{position:'absolute',left:100,top:65,fontFamily:sans,fontSize:22,letterSpacing:3,color:C.olive,fontWeight:600}}>PAPERPLAY / AN IDEA IN MOTION</div>
  <div style={{position:'absolute',left:100,top:116,fontFamily:serif,fontSize:84,letterSpacing:-1.5}}>Momentum remembers the last step.</div>
  <div style={{position:'absolute',left:104,top:222,fontSize:27,color:C.soft}}>Move β. Reshape the path. Replay each step from the same start.</div>
  <div style={{position:'absolute',left:100,top:305,width:1060,height:600,borderRadius:24,border:`1px solid ${C.line}`,background:C.paper,boxShadow:'0 16px 36px #172f2d12',overflow:'hidden'}}>
   <div style={{padding:'25px 32px',display:'flex',justifyContent:'space-between',fontSize:23,color:C.soft}}><span>The path of every step</span><span style={{fontVariantNumeric:'tabular-nums'}}>STEP {String(step).padStart(2,'0')} / 64</span></div>
   <svg width="1060" height="440" viewBox="0 0 1060 440" style={{display:'block'}}>
    <defs><marker id="momentum-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill={color}/></marker></defs>
    {[.025,.065,.15,.32,.65,1.1].map((loss,n)=><ellipse key={loss} cx="530" cy="230" rx={Math.sqrt(2*loss/.06)*91} ry={Math.sqrt(2*loss)*156} fill={n===5?'#edf3e8':'none'} stroke={C.olive} strokeOpacity={.1+n*.025} strokeWidth="1.5"/>).reverse()}
    <line x1="45" y1="230" x2="1015" y2="230" stroke={C.olive} strokeOpacity=".13"/>
    <circle cx="530" cy="230" r="8" fill={C.paper} stroke={C.olive} strokeWidth="2"/>
    <path d="M525 230h10M530 225v10" stroke={C.olive} strokeWidth="1.3"/>
    <text x="530" y="269" textAnchor="middle" fill={C.soft} fontSize="21" fontFamily={sans}>minimum</text>
    <polyline points={points.map(p=>p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="3.2" strokeLinejoin="round" opacity=".65"/>
    {trace.slice(0,step+1).filter((_,n)=>n%3===0).map((p,n)=>{const [px,py]=xy(p.x,p.y);return <circle key={n} cx={px} cy={py} r="3" fill={color} opacity=".45"/>;})}
    {speed>.7&&<line x1={cx} y1={cy} x2={Math.max(20,Math.min(1040,cx+vx*91*arrowScale))} y2={Math.max(20,Math.min(420,cy-vy*156*arrowScale))} stroke={color} strokeWidth="3" markerEnd="url(#momentum-arrow)"/>}
    <circle cx={cx} cy={cy} r="21" fill={color} opacity=".1"/>
    <circle cx={cx} cy={cy} r="10" fill={color} stroke={C.paper} strokeWidth="3"/>
    {step===0&&<text x={cx-16} y={cy-28} textAnchor="end" fontFamily={sans} fontSize="22" fill={color}>same start</text>}
   </svg>
   <div style={{padding:'12px 32px',fontSize:21,color:C.soft,display:'flex',justifyContent:'space-between'}}><span>Objective reduction</span><span style={{fontVariantNumeric:'tabular-nums',color}}>{reduction>.995?'>99%':`${Math.round(reduction*100)}%`}</span></div>
   <div style={{margin:'0 32px',height:5,borderRadius:8,background:C.chrome,overflow:'hidden'}}><div style={{height:'100%',width:`${reduction*100}%`,background:color}}/></div>
  </div>
  <div style={{position:'absolute',left:1200,top:305,width:600,height:270,borderRadius:24,border:`1px solid ${C.line}`,background:C.paper}}>
   <div style={{padding:'30px 36px',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><span style={{fontSize:26,color:C.soft}}>Momentum β</span><span style={{fontFamily:serif,fontSize:68,lineHeight:1,color,fontVariantNumeric:'tabular-nums'}}>{beta.toFixed(2)}</span></div>
   <div style={{position:'absolute',left:44,top:150,width:500,height:6,borderRadius:9,background:C.line}}><div style={{width:`${beta/.99*100}%`,height:'100%',borderRadius:9,background:color}}/></div>
   <div style={{position:'absolute',left:thumb-1200-12,top:142,width:24,height:24,borderRadius:'50%',border:`4px solid ${C.paper}`,background:color,boxShadow:'0 2px 8px #172f2d40'}}/>
   <div style={{position:'absolute',left:44,right:56,top:182,display:'flex',justifyContent:'space-between',fontSize:20,color:C.soft}}><span>0 · fresh step</span><span>0.99 · long memory</span></div>
  </div>
  {dragging&&<svg style={{position:'absolute',left:thumb+4,top:sliderY+5,width:40,height:46,filter:'drop-shadow(0 2px 3px #0003)'}} viewBox="0 0 28 34"><path d="M3 2v25l7-7 5 11 5-2-5-11h10z" fill={C.ink} stroke={C.paper} strokeWidth="2"/></svg>}
  <div style={{position:'absolute',left:1200,top:605,width:600,height:300,padding:'32px 36px',boxSizing:'border-box',borderRadius:24,background:C.paper,border:`1px solid ${C.line}`}}>
   <div style={{fontFamily:serif,fontSize:42,lineHeight:1.13,color}}>{label}</div>
   <div style={{marginTop:20,fontSize:23,lineHeight:1.45,color:C.soft}}>{detail}</div>
  </div>
  <div style={{position:'absolute',left:104,top:935,fontSize:22,color:C.soft}}>● Current position　 → Carried velocity　 ··· Previous steps</div>
  <div style={{position:'absolute',right:120,top:935,fontSize:22,color:C.soft}}>v ← βv − α∇f　　x ← x + v</div>
  <div style={{position:'absolute',left:104,top:1000,fontSize:19,color:C.soft}}>f(x, y) = ½(0.06x² + y²) · α = 0.25 · schematic axes</div>
 </Stage>;
}
