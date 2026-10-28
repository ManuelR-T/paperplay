'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {SourceDocument} from '@/shared/schema';
import {emptyEnrichmentState,enrichmentFingerprint,enrichmentSourceIdentity,enrichmentStorageKey,parseEnrichmentState,type EnrichmentState} from '@/lib/enrichment/state';
/** Read existing local analysis history without starting planning or altering incompatible storage. */
export function useEnrichmentCoverage(source:SourceDocument){
 const identity=useMemo(()=>enrichmentSourceIdentity(source),[source]),[slot,setSlot]=useState<{identity:string;state?:EnrichmentState;warning?:string}|null>(null);
 useEffect(()=>{let active=true,key:string|undefined;const load=async()=>{try{const fingerprint=await enrichmentFingerprint(source);if(!active)return;key=enrichmentStorageKey(source,fingerprint);const raw=localStorage.getItem(key),state=raw?parseEnrichmentState(raw,source,fingerprint):emptyEnrichmentState(fingerprint);if(active)setSlot({identity,state});}catch{if(active)setSlot({identity,warning:'Saved analysis history could not be checked. Its original record is unchanged; this coverage view does not claim those sections were analyzed.'});}};void load();const changed=(event:StorageEvent)=>{if(event.key===key)void load();};window.addEventListener('storage',changed);return()=>{active=false;window.removeEventListener('storage',changed);};},[identity]);
 const onStateChange=useCallback((state:EnrichmentState)=>setSlot({identity,state}),[identity]);
 return {state:slot?.identity===identity?slot.state:undefined,warning:slot?.identity===identity?slot.warning:undefined,onStateChange};
}
