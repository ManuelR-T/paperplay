'use client';
import { useEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import type { ScientificAsset } from '@/shared/scientific-assets';
import type { RepresentationPlan } from '@/shared/representations';
import { isRepresentationSelection, representationInputRevision, initialRepresentationNavigation } from '@/shared/representation-selection';
import { createSemanticSelectionStore } from '@/lib/interactions/selection-store';
export function useRepresentationSelections(plan:RepresentationPlan|null,assets?:readonly ScientificAsset[]){
 const [selectionWarning,setSelectionWarning]=useState('');
 const latest=useRef({plan,assets});latest.current={plan,assets};
 const revision=useMemo(()=>plan?representationInputRevision(plan):'0000000000000000',[plan]);
 const [store]=useState(()=>createSemanticSelectionStore({onLimit:setSelectionWarning,revision,initial:plan?initialRepresentationNavigation(plan):undefined,isValid:selection=>!!latest.current.plan&&isRepresentationSelection(latest.current.plan,selection,latest.current.assets)}));
 useEffect(()=>{store.rebindInputs(revision,selection=>!!latest.current.plan&&isRepresentationSelection(latest.current.plan,selection,latest.current.assets));},[revision,store]);
 const navigation=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 return {store,navigation,selectionWarning};
}
