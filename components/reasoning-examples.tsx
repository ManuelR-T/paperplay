'use client';
import { useMemo,useState } from 'react';
import { createReasoningExample,type ReasoningExampleKind } from '@/lib/representations/reasoning-examples';
import { ScientificStudyView } from './scientific-study';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
export function ReasoningExamples(){const [kind,setKind]=useState<ReasoningExampleKind|null>(null);return <section aria-label="Arguments and experimental protocols"><h3>Follow arguments and methods</h3><p>Source-linked assumptions, equations and steps. Missing details stay visible.</p><div className="reader-choice"><Button variant="outline" onClick={()=>setKind('bell')}>Bell argument</Button><Button variant="outline" onClick={()=>setKind('voltage-clamp')}>Partial voltage-clamp protocol</Button></div>{kind&&<Example key={kind} kind={kind} onClose={()=>setKind(null)}/>}</section>;}
function Example({kind,onClose}:{kind:ReasoningExampleKind;onClose:()=>void}){const study=useMemo(()=>createReasoningExample(kind),[kind]);return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{study.plan.title}</DialogTitle><DialogDescription>Read source-linked steps without running a model, proof checker or experiment.</DialogDescription><ScientificStudyView study={study}/></DialogContent></Dialog>;}
