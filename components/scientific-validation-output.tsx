'use client';
import {useEffect,useState} from 'react';
import {digestValidationOutput,type ScientificValidationTarget} from '@/lib/validation/model';
import type {EngineRun} from '@/lib/engines';
import type {DynamicsResult} from '@/shared/dynamics';
import {ScientificValidationPanel} from './scientific-validation';
/** Bind a verification action to the actual shown output without treating JSON as authority. */
export function ScientificValidationOutput({target,output,unavailable}:{target:ScientificValidationTarget;output:EngineRun|EngineRun[]|DynamicsResult|null;unavailable?:string}){
 const [slot,setSlot]=useState<{output:typeof output;digest?:string;error?:string}|null>(null);
 useEffect(()=>{let active=true;if(!output)return;void digestValidationOutput(output).then(digest=>{if(active)setSlot({output,digest});}).catch(()=>{if(active)setSlot({output,error:'The displayed output identity could not be checked.'});});return()=>{active=false;};},[output]);
 const current=slot?.output===output?slot:null;
 return <ScientificValidationPanel target={{...target,displayedOutputSha256:current?.digest}} disabledReason={unavailable??(!output?'Wait for a complete current result before checking.':current?.error??(!current?.digest?'Checking the displayed output identity…':undefined))}/>;
}
