'use client';
import { useEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import type { RepresentationPlan } from '@/shared/representations';
import { isRepresentationSelection, representationInputRevision, initialRepresentationNavigation } from '@/shared/representation-selection';
import { createSemanticSelectionStore } from '@/lib/interactions/selection-store';
export function useRepresentationSelections(plan:RepresentationPlan|null){
 const [selectionWarning,setSelectionWarning]=useState('');
 const latest=useRef(plan);latest.current=plan;
 const revision=useMemo(()=>plan?representationInputRevision(plan):'0000000000000000',[plan]);
 const [store]=useState(()=>createSemanticSelectionStore({onLimit:setSelectionWarning,revision,initial:plan?initialRepresentationNavigation(plan):undefined,isValid:selection=>!!latest.current&&isRepresentationSelection(latest.current,selection)}));
 useEffect(()=>{store.rebindInputs(revision,selection=>!!latest.current&&isRepresentationSelection(latest.current,selection));},[revision,store]);
 const navigation=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 return {store,navigation,selectionWarning};
}
