'use client';
import {useEffect,useState} from 'react';
import {buildRepresentationCoverage} from '@/lib/coverage/model';
import {RepresentationCoveragePanel} from './representation-coverage';
type Input=Parameters<typeof buildRepresentationCoverage>[0];
type Report=Awaited<ReturnType<typeof buildRepresentationCoverage>>;
export function CoverageForSource({input,onReturn,onFallback,onAction}:{input:Input;onReturn?:(blockId:string)=>void;onFallback?:(plan:unknown)=>void;onAction?:(sectionId:string,action:unknown)=>void}){
 const [slot,setSlot]=useState<{input:Input;coverage?:Report;error?:string}|null>(null);
 useEffect(()=>{let active=true;void buildRepresentationCoverage(input).then(coverage=>{if(active)setSlot({input,coverage});}).catch(()=>{if(active)setSlot({input,error:'Coverage could not be checked against this saved source. The source and existing representations remain available.'});});return()=>{active=false;};},[input.source,input.widgets,input.plans,input.enrichment,input.gaps,input.reviews]);
 const current=slot&&slot.input.source===input.source&&slot.input.widgets===input.widgets&&slot.input.plans===input.plans&&slot.input.enrichment===input.enrichment&&slot.input.gaps===input.gaps&&slot.input.reviews===input.reviews?slot:null;
 return current?.coverage?<RepresentationCoveragePanel source={input.source} coverage={current.coverage} onReturn={onReturn} onFallback={onFallback} onAction={onAction}/>:<p role="status">{current?.error??'Checking coverage of the saved source…'}</p>;
}
