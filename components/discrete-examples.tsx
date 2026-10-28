'use client';
import {useMemo,useState} from 'react';
import {createDiscreteExample,type DiscreteExampleId} from '@/lib/representations/discrete-examples';
import {ScientificStudyView} from './scientific-study';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
export function DiscreteExamples(){const [kind,setKind]=useState<DiscreteExampleId|null>(null);return <section aria-label="Discrete algorithm examples"><h3>Explore changing collections</h3><p>Inspect FIFO topological sorting and growing disjoint sets, one real algorithm step at a time.</p><div className="reader-choice">{([{id:'dag',label:'Topological ordering'},{id:'cycle-tail',label:'Cycle and blocked tail'},{id:'union-find',label:'Growing union–find'}] as const).map(item=><Button key={item.id} variant="outline" onClick={()=>setKind(item.id)}>{item.label}</Button>)}</div>{kind&&<Example kind={kind} onClose={()=>setKind(null)}/>}</section>;}
function Example({kind,onClose}:{kind:DiscreteExampleId;onClose:()=>void}){const study=useMemo(()=>createDiscreteExample(kind),[kind]);return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{study.plan.title}</DialogTitle><DialogDescription>Authored examples with local deterministic execution and explicit resource limits.</DialogDescription><ScientificStudyView study={study}/></DialogContent></Dialog>;}
