import {Cursor} from '../components';
import {C,sans} from '../theme';
import type {SdkFrame} from '../../../shared/figure-sdk';

const paints={ink:'#14252b',muted:'#64757c',accent:'#136f63',positive:'#28682b',warning:'#a05413'};
const fills={ink:'#dbe4e8',muted:'#eef1f2',accent:'#c7e9df',positive:'#dceccf',warning:'#ffe0b2'};
/** Same SDK marks and table as the app, replayed together without capture latency. */
export function ReplayChart({frame}:{frame:SdkFrame}){
 return <svg width="1010" height="786" viewBox={`-24 -24 ${frame.coordinateSpace.width+48} ${frame.coordinateSpace.height+48}`} style={{display:'block',background:'#f8fbfa',fontFamily:sans}} aria-label={frame.title}>
  {frame.marks.map(mark=><g key={mark.id}>{mark.kind==='line'?<line x1={mark.from[0]} y1={mark.from[1]} x2={mark.to[0]} y2={mark.to[1]} stroke={paints[mark.paint]} strokeWidth={2}/>:mark.kind==='rectangle'?<rect x={mark.at[0]} y={mark.at[1]} width={mark.size[0]} height={mark.size[1]} fill={fills[mark.paint]} stroke={paints.ink}/>:mark.kind==='circle'?<circle cx={mark.center[0]} cy={mark.center[1]} r={mark.radius} fill={fills[mark.paint]} stroke={paints[mark.paint]}/>:<text x={mark.at[0]} y={mark.at[1]} textAnchor="middle" dominantBaseline="middle" fill={paints.ink} fontSize={16}>{mark.text}</text>}</g>)}
 </svg>;
}
export function ReplayControls({frame,value,dragging}:{frame:SdkFrame;value:number;dragging:boolean}){
 const slider=frame.controls.find(control=>control.kind==='slider');
 if(!slider||slider.kind!=='slider')throw Error('Replay requires the saved model slider');
 const thumb=34+(value-slider.min)/(slider.max-slider.min)*620;
 return <div style={{height:'100%',position:'relative',padding:'26px 30px',boxSizing:'border-box',fontFamily:sans,color:C.ink}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',fontSize:25}}><span>{slider.label}</span><span style={{fontVariantNumeric:'tabular-nums',fontWeight:600}}>{value.toFixed(2)}</span></div>
  <div style={{position:'absolute',left:34,top:102,width:620,height:5,borderRadius:6,background:C.line}}/>
  <div style={{position:'absolute',left:thumb-10,top:94,width:20,height:20,boxSizing:'border-box',borderRadius:'50%',background:C.olive,border:`3px solid ${C.paper}`,boxShadow:'0 1px 4px #172f2d40'}}/>
  <div style={{marginTop:98,fontSize:18,textAlign:'center',color:C.soft}}>{frame.table.caption}</div>
  <table style={{width:'100%',marginTop:12,borderCollapse:'collapse',fontSize:22,tableLayout:'fixed'}}>
   <thead><tr>{frame.table.columns.map((column,i)=><th key={column} style={{width:i===0?'75%':'25%',padding:'14px 8px',textAlign:'left',borderBottom:`1px solid ${C.line}`,fontSize:20}}>{column}</th>)}</tr></thead>
   <tbody>{frame.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} style={{padding:'15px 8px',borderBottom:`1px solid ${C.line}`,fontVariantNumeric:'tabular-nums'}}>{cell===null?'Missing':String(cell)}</td>)}</tr>)}</tbody>
  </table>
  <Cursor x={thumb} y={104} size={38} press={{held:dragging,since:Infinity}}/>
 </div>;
}
