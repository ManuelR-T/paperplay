'use client';
import { useMemo, useState } from 'react';
import type { ComposedScene, ScientificScene } from '@/shared/composed-scene';
import { diagnoseScene, sceneLayout, sceneSpacing } from '@/lib/scenes/layout';
import { Button } from './ui/button';
import styles from './composed-scene.module.css';
const colors={ink:'#334155',blue:'#2563eb',green:'#15803d',amber:'#a16207',red:'#b91c1c',purple:'#7e22ce'};
export function ComposedSceneView({scene,onReturn}:{scene:ComposedScene;onReturn:(anchorId:string)=>void}){
 const nodes=new Map(scene.nodes.map(node=>[node.id,node]));
 function render(id:string):React.ReactNode{
   const node=nodes.get(id)!;
   if(node.kind==='scene')return <ScientificSceneView key={id} scene={node}/>;
   if(node.kind==='text')return <p key={id}>{node.text}</p>;
   if(node.kind==='legend')return <ul key={id} className={styles.legend} aria-label="Figure legend">{node.items.map((item,index)=><li key={index}><span aria-hidden className={styles.swatch} style={{background:colors[item.color]}}/>{item.label}</li>)}</ul>;
   if(node.kind==='annotation')return <aside key={id} className={styles.annotation}><strong>{node.role==='source'?'Source quotation':'Added assumption / explanation'}</strong><p>{node.text}</p>{node.anchorIds.map(id=><Button key={id} variant="ghost" onClick={()=>onReturn(id)}>Read cited passage</Button>)}</aside>;
   if(node.kind==='slot')return <section key={id} className={styles.panel}><h3>{node.title}</h3><p>{node.description}</p><p>Declared {node.slot} slot · numerical/text fallback. No specialized computation or rendering is implied.</p><div className={styles.scroll} tabIndex={0} role="region" aria-label={`${node.title} values`}><table className={styles.table}><caption>Declared illustrative values</caption><thead><tr><th>Label</th><th>Value</th><th>Unit</th></tr></thead><tbody>{node.values.map((value,index)=><tr key={index}><th scope="row">{value.label}</th><td>{value.value}</td><td>{value.unit}</td></tr>)}</tbody></table></div></section>;
   const content=node.children.map(render);
   return node.kind==='panel'?<section key={id} className={styles.panel}><h3>{node.title}</h3>{content}</section>:<div key={id} className={node.kind==='grid'?styles.grid:styles.row} style={node.kind==='grid'?{'--requested-columns':node.columns} as React.CSSProperties:undefined}>{content}</div>;
 }
 return <div className={styles.composition} style={{'--scene-gap':`${sceneSpacing.gap}px`,'--scene-panel':`${sceneSpacing.panel}px`} as React.CSSProperties}>{render(scene.rootId)}</div>;
}
function ScientificSceneView({scene}:{scene:ScientificScene}){
 const [frame,setFrame]=useState(-1);const layout=useMemo(()=>sceneLayout(scene,frame),[scene,frame]);const diagnostics=useMemo(()=>diagnoseScene(scene),[scene]);
 const current=scene.frames[frame];
 return <section className={styles.scene} aria-label={scene.title}><h3>{scene.title}</h3><p>{scene.description}</p><p className={styles.caption}>Declared coordinates: {scene.coordinates.frame}. {scene.coordinates.xAxis} / {scene.coordinates.yAxis} · {scene.coordinates.unit}. Layout pixels are separate from these coordinates.</p>
   {scene.frames.length>0&&<div className={styles.controls} role="group" aria-label={`${scene.title} walkthrough`}><Button variant="outline" disabled={frame<0} onClick={()=>setFrame(frame-1)}>Previous</Button><Button variant="outline" disabled={frame>=scene.frames.length-1} onClick={()=>setFrame(frame+1)}>Next</Button><Button variant="ghost" onClick={()=>setFrame(-1)}>Reset scene</Button><p role="status">{current?`${frame+1}/${scene.frames.length} · ${current.label}`:'Initial state'} · authored walkthrough</p></div>}
   <p className={styles.caption}>The diagram and value tables scroll horizontally if needed. Numbered marks have full labels and exact declared values below.</p>
   <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${scene.title} diagram; scroll horizontally`}><svg className={styles.canvas} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${scene.title}. Full equivalent values and relationships follow.`}>
    {scene.relationships.map(edge=>{const a=layout.marks.find(m=>m.id===edge.from)!,b=layout.marks.find(m=>m.id===edge.to)!;return a.visible&&b.visible?<g key={edge.id}><line x1={a.screenX} y1={a.screenY} x2={b.screenX} y2={b.screenY} stroke="#64748b" strokeWidth="2"/><circle cx={b.screenX+(a.screenX-b.screenX)*.15} cy={b.screenY+(a.screenY-b.screenY)*.15} r="3" fill="#64748b"/></g>:null;})}
    {layout.marks.filter(mark=>mark.visible).map(mark=><g key={mark.id}>{mark.width?<rect x={mark.screenX-mark.screenWidth/2} y={mark.screenY-mark.screenHeight/2} width={Math.max(mark.screenWidth,24)} height={Math.max(mark.screenHeight,24)} rx="4" fill={colors[mark.color]} fillOpacity=".18" stroke={colors[mark.color]}/>:<circle cx={mark.screenX} cy={mark.screenY} r={mark.screenRadius} fill={colors[mark.color]}/>}<text x={mark.screenX} y={mark.screenY+5} textAnchor="middle" fontSize="14" fill={mark.width?colors[mark.color]:'#fff'}>{mark.index}</text></g>)}
   </svg></div>
   {diagnostics.length>0&&<p className={styles.warning} role="status">Layout needs attention: {diagnostics.length} overlapping mark pair(s) across the walkthrough. No labels were removed. Use the complete values below; adjust coordinates to separate the marks.</p>}
   <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${scene.title} complete values`}><table className={styles.table}><caption>All objects · {current?.label??'Initial state'}</caption><thead><tr><th>Mark and full label</th><th>{scene.coordinates.xAxis}</th><th>{scene.coordinates.yAxis}</th><th>Value / state</th></tr></thead><tbody>{layout.marks.map(mark=><tr key={mark.id}><th scope="row">{mark.index}. {mark.label}</th><td>{mark.x} {scene.coordinates.unit}</td><td>{mark.y} {scene.coordinates.unit}</td><td>{mark.value===undefined?'No measured value declared':`${mark.value} ${mark.unit??'(unit undeclared)'}`} · {mark.visible?'visible':'hidden by authored frame'}{mark.width!==undefined?` · extent ${mark.width} × ${mark.height} ${scene.coordinates.unit}`:''}</td></tr>)}</tbody></table></div>
   {scene.relationships.length>0&&<div className={styles.scroll} tabIndex={0} role="region" aria-label={`${scene.title} relationships`}><table className={styles.table}><caption>Declared relationships · arrows do not establish causality</caption><thead><tr><th>From</th><th>To</th><th>Meaning</th></tr></thead><tbody>{scene.relationships.map(edge=><tr key={edge.id}><td>{layout.marks.find(m=>m.id===edge.from)!.label}</td><td>{layout.marks.find(m=>m.id===edge.to)!.label}</td><td>{edge.label}</td></tr>)}</tbody></table></div>}
 </section>;
}
