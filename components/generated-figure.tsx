'use client';
import { useEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import type { SourceDocument } from '@/shared/schema';
import type { BuiltFigureArtifact } from '@/lib/artifacts/lifecycle';
import { runFigureArtifact } from '@/lib/artifacts/lifecycle';
import { compileFigureInWorker } from '@/lib/artifacts/compiler-client';
import { compilerRequestFromBuild } from '@/lib/artifacts/compiler-request';
import { createCompiledFigureAdapter,validateFigureEvent } from '@/lib/artifacts/runtime-client';
import { figureRuntimeInput } from '@/lib/artifacts/runtime-input';
import type { FigureExecutionAdapter } from '@/lib/artifacts/lifecycle';
import type { SdkFrame,SdkEvent } from '@/shared/figure-sdk';
import { isSdkSelection,sdkSelectionRevision } from '@/shared/figure-selection';
import { createSemanticSelectionStore } from '@/lib/interactions/selection-store';
import { Button } from './ui/button';
import styles from './generated-figure.module.css';
import { GeneratedFigureDisplay } from './generated-figure-display';
export function GeneratedFigure({built,source,onReturn,autoStart=false}:{autoStart?:boolean;built:BuiltFigureArtifact;source:SourceDocument;onReturn:(anchorId:string)=>void}){
 const [frame,setFrame]=useState<SdkFrame|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),adapter=useRef<FigureExecutionAdapter|null>(null),current=useRef(frame);current.current=frame;
 const [store]=useState(()=>createSemanticSelectionStore({revision:sdkSelectionRevision(built.contentSha256,null),isValid:value=>isSdkSelection(built.manifest.id,current.current,value)}));
 const navigation=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot),selected=navigation.selections.find(value=>value.kind==='entity');
 const revision=useMemo(()=>sdkSelectionRevision(built.contentSha256,frame),[built.contentSha256,frame]);
 useEffect(()=>{store.rebindInputs(revision,value=>isSdkSelection(built.manifest.id,current.current,value));},[revision,store,built.manifest.id]);
 useEffect(()=>{if(autoStart)void start();return()=>{const job=controller.current;controller.current=null;job?.abort();};},[]);
 async function execute(event:SdkEvent,signal:AbortSignal,executor:FigureExecutionAdapter){if(current.current)validateFigureEvent(current.current,event);const run=await runFigureArtifact(built,source,{executionAdapter:executor,input:figureRuntimeInput(built),state:current.current?.state??null,event,signal});if(signal.aborted)return;if(run.status!=='ready'||!('marks'in run.value))throw Error(run.status==='ready'?'Invalid figure result.':run.reason);current.current=run.value;setFrame(run.value);setMessage('');}
 async function start(){controller.current?.abort();const job=new AbortController();controller.current=job;setBusy(true);setError('');setMessage('Preparing preview…');try{const compiled=await compileFigureInWorker(compilerRequestFromBuild(built),{signal:job.signal});if(job.signal.aborted)return;if(compiled.status!=='ready')throw Error(compiled.diagnostics.map(d=>d.message).join(' '));adapter.current=createCompiledFigureAdapter(built,compiled.artifact,compiled.sha256);await execute({kind:'initialize'},job.signal,adapter.current);}catch(problem){if(!job.signal.aborted){setError(problem instanceof Error?problem.message:'Figure unavailable.');setMessage('Last valid figure retained.');}}finally{if(controller.current===job){controller.current=null;setBusy(false);}}}
 async function act(event:SdkEvent){if(controller.current||!adapter.current)return;const job=new AbortController();controller.current=job;setBusy(true);setError('');setMessage('');try{await execute(event,job.signal,adapter.current);}catch(problem){if(!job.signal.aborted){setError(problem instanceof Error?problem.message:'Interaction unavailable.');setMessage('Last valid figure retained.');}}finally{if(controller.current===job){controller.current=null;setBusy(false);}}}
 function stop(){const job=controller.current;controller.current=null;job?.abort();setBusy(false);setMessage('Stopped. Last valid figure retained.');}
 function select(id:string){if(controller.current)return;store.select({kind:'entity',viewId:built.manifest.id,scopeId:'sdk',entityId:id});void act({kind:'entity',id});}
 const selectedId=selected?.kind==='entity'?selected.entityId:undefined;
 const selectedAnchors=selectedId?[...new Set(frame?.marks.flatMap(mark=>mark.entityId===selectedId&&mark.anchorId?[mark.anchorId]:[])??[])]:[];
 return <section className={styles.figure} aria-label="Isolated generated figure">{(!frame||error)&&<div className={styles.controls}>{!busy&&<Button onClick={()=>void start()}>{frame?'Retry preview':'Open interactive preview'}</Button>}{busy&&<Button variant="outline" onClick={stop}>Stop figure</Button>}</div>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}{frame&&<GeneratedFigureDisplay frame={frame} showTitle={frame.title!==built.manifest.title} busy={busy} selectedId={selectedId} onSelect={select} onControl={event=>void act(event)} onReturn={onReturn} onStop={stop} selectionActions={(navigation.selections.length>0||store.canUndo())&&<div className={styles.controls}><Button variant="ghost" disabled={!store.canUndo()} onClick={()=>store.undo()}>Undo selection</Button><Button variant="ghost" disabled={!navigation.selections.length} onClick={()=>store.clear()}>Clear selection</Button>{selectedAnchors.map(id=><Button key={id} variant="outline" onClick={()=>onReturn(id)}>Read selected source</Button>)}</div>}/>}</section>;
}
