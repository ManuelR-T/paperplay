'use client';
import { useMemo,useState } from 'react';
import { createFieldExample,type FieldExampleId } from '@/lib/representations/field-examples';
import { ScientificStudyView } from './scientific-study';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
export function FieldExamples(){const [kind,setKind]=useState<FieldExampleId|null>(null);return <section aria-label="Physical field examples"><h3>Explore diffusion fields</h3><p>Cell-average temperature fields with linked probes, explicit boundaries and numerical limits.</p><div className="reader-choice">{([{id:'periodic-1d',label:'1D periodic field'},{id:'no-flux-1d',label:'1D insulated field'},{id:'periodic-2d',label:'2D periodic field'}] as const).map(item=><Button key={item.id} variant="outline" onClick={()=>setKind(item.id)}>{item.label}</Button>)}</div>{kind&&<Example key={kind} kind={kind} onClose={()=>setKind(null)}/>}</section>;}
function Example({kind,onClose}:{kind:FieldExampleId;onClose:()=>void}){const study=useMemo(()=>createFieldExample(kind),[kind]);return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{study.plan.title}</DialogTitle><DialogDescription>Authored mathematical field; no research experiment or material measurement is reproduced.</DialogDescription><ScientificStudyView study={study}/></DialogContent></Dialog>;}
