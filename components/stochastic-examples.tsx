'use client';
import { useMemo,useState } from 'react';
import { createStochasticExample,type StochasticExampleId } from '@/lib/representations/stochastic-examples';
import { ScientificStudyView } from './scientific-study';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
export function StochasticExamples(){const [kind,setKind]=useState<StochasticExampleId|null>(null);return <section aria-label="Stochastic population examples"><h3>Explore random populations</h3><p>Seeded local trajectories, shared observation times and clearly separated process spread and analytic expectations.</p><div className="reader-choice"><Button variant="outline" onClick={()=>setKind('pure-death')}>Random loss</Button><Button variant="outline" onClick={()=>setKind('two-state-pool')}>Independent gate pool</Button></div>{kind&&<Example key={kind} kind={kind} onClose={()=>setKind(null)}/>}</section>;}
function Example({kind,onClose}:{kind:StochasticExampleId;onClose:()=>void}){const study=useMemo(()=>createStochasticExample(kind),[kind]);return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{study.plan.title}</DialogTitle><DialogDescription>{kind==='two-state-pool'?'A source-located gating equation with an authored finite-pool illustration; no channel current or organism is simulated.':'An authored mathematical population model, not experimental observations.'}</DialogDescription><ScientificStudyView study={study}/></DialogContent></Dialog>;}
