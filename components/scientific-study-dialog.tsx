'use client';
import { ScientificStudyView,type ScientificStudy } from './scientific-study';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
/** A checked imported study keeps its own source instead of replacing the reader's paper. */
export function ScientificStudyDialog({study,onClose}:{study:ScientificStudy;onClose:()=>void}){return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{study.plan.title}</DialogTitle><DialogDescription>Explore the saved study’s source, figures, settings and selections.</DialogDescription><ScientificStudyView study={study}/></DialogContent></Dialog>;}
