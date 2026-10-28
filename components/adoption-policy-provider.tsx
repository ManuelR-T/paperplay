'use client';
import {useEffect,useSyncExternalStore,type ReactNode} from 'react';
import {getAdoptionPolicySnapshot,subscribeAdoptionPolicy,refreshAdoptionPolicy} from '@/lib/adoption/policy';
import type {AdoptionPolicySnapshot} from '@/shared/adoption';
const serverSnapshot:AdoptionPolicySnapshot=Object.freeze({state:'unknown',epoch:0,policy:null});
/** One application-level availability refresh; this never creates model or execution jobs. */
export function AdoptionPolicyProvider({children}:{children:ReactNode}){
 useEffect(()=>{void refreshAdoptionPolicy();const refresh=()=>{void refreshAdoptionPolicy();};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 return children;
}
export function useAdoptionPolicy(){
 const snapshot=useSyncExternalStore(subscribeAdoptionPolicy,getAdoptionPolicySnapshot,()=>serverSnapshot);
 const ready=snapshot.state==='ready';
 return {...snapshot,generatedAllowed:ready&&snapshot.policy?.generatedExecution===true,newModelAllowed:ready&&snapshot.policy?.newModelCreation===true,
 generatedMessage:snapshot.state==='unknown'?'Checking whether interactive code is available…':snapshot.state==='unavailable'?'Interactive code is unavailable right now. Source, recorded frames and downloads remain available.':'Interactive code is disabled here. Source, recorded frames and downloads remain available.',
 modelMessage:snapshot.state==='unknown'?'Checking whether new Meta figures are available…':snapshot.state==='unavailable'?'New Meta figures are unavailable right now. Saved jobs and figures remain available.':'Creating new figures with Meta is disabled here. Saved jobs and figures remain available.'};
}
/** UI convenience only; authoritative execution and creation guards also run below this layer. */
export async function requireAdoptionPermission(kind:'generatedExecution'|'newModelCreation'){
 const snapshot=await refreshAdoptionPolicy();
 if(snapshot.state!=='ready')throw Error(kind==='generatedExecution'?'Interactive code is unavailable right now. Source, recorded frames and downloads remain available.':'New Meta figures are unavailable right now. Saved jobs and figures remain available.');
 if(!snapshot.policy?.[kind])throw Error(kind==='generatedExecution'?'Interactive code is disabled here. Source, recorded frames and downloads remain available.':'Creating new figures with Meta is disabled here. Retrieve or cancel saved jobs, or keep using existing figures.');
}
