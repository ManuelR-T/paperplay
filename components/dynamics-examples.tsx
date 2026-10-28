'use client';
import { useMemo,useState } from 'react';
import { createDynamicsExample,type DynamicsExampleId } from '@/lib/representations/dynamics-examples';
import { ScientificStudyView } from './scientific-study';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
export function DynamicsExamples(){const [kind,setKind]=useState<DynamicsExampleId|null>(null);return <section aria-label="Authored dynamics examples"><h3>Explore differential models</h3><p>Local mathematical examples with units, numerical limits and inspectable stored values.</p><div className="reader-choice">{([{id:'decay',label:'Decay'},{id:'oscillator',label:'Damped oscillator'},{id:'reaction-chain',label:'Reaction chain'},{id:'threshold-decay',label:'Threshold and reset'}] as const).map(item=><Button key={item.id} variant="outline" onClick={()=>setKind(item.id)}>{item.label}</Button>)}</div>{kind&&<Example key={kind} kind={kind} onClose={()=>setKind(null)}/>}</section>;}
function Example({kind,onClose}:{kind:DynamicsExampleId;onClose:()=>void}){const study=useMemo(()=>createDynamicsExample(kind),[kind]);return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{study.plan.title}</DialogTitle><DialogDescription>Paperplay-authored engineering fixture; no paper experiment or measurement is reproduced.</DialogDescription><ScientificStudyView study={study}/></DialogContent></Dialog>;}
