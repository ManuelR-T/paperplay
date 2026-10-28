import {automaticPaperStorageKey,automaticPaperStateSchema} from '../automatic/pipeline';
import type { SourceDocument } from '../../shared/schema';
import { enrichmentFingerprint,enrichmentStorageKey,parseEnrichmentState,forgetEnrichment } from '../enrichment/state';
import { generationStorageKey,parseGenerationState } from '../artifacts/generation-state';
import { createArtifactExperimentStorage,type ArtifactExperimentStorage } from '../artifacts/experiment-storage';
import { artifactExperimentOwner } from '../../shared/artifact-experiment';
/** Paid jobs keep their source context until the reader resolves or explicitly cancels them. */
export async function checkPendingSourcePlans(source:SourceDocument,storage:Storage){
 const fingerprint=await enrichmentFingerprint(source);let uncertain=false;
 const automatic=storage.getItem(automaticPaperStorageKey(source,fingerprint));
 if(automatic){if(new TextEncoder().encode(automatic).length>2_000_000)throw Error('The automatic preparation record is too large; its original recovery references were retained.');const state=automaticPaperStateSchema.parse(JSON.parse(automatic));if(state.fingerprint!==fingerprint)throw Error('The automatic preparation source identity is incompatible. Its recovery record was retained.');if(state.pending)throw Error('This paper has an unresolved automatic figure request. Continue preparation to recover its result before removing the source; its request reference was retained.');}
 const catalog=storage.getItem(enrichmentStorageKey(source,fingerprint));
 if(catalog){const state=parseEnrichmentState(catalog,source,fingerprint);if(state.pending?.job)throw Error('This paper has an accepted figure plan. Open the Meta planner and cancel or resolve it before removing the source; its recovery reference was retained.');uncertain=!!state.pending;}
 const generated=storage.getItem(generationStorageKey(source,fingerprint));
 if(generated){const state=parseGenerationState(generated,source,fingerprint);if(state.pending&&state.reply&&['queued','analyzing'].includes(state.reply.status))throw Error('This paper has an accepted generated figure attempt. Open Generate a new interaction and retrieve or cancel it before removing the source; its recovery context was retained.');uncertain=uncertain||!!state.pending;}
 return {uncertain};
}
/** Remove only this document's references; shared records and invalid originals are retained. */
export async function forgetSourceWidgets(sourceId:string,storage:Storage,experiments:ArtifactExperimentStorage=createArtifactExperimentStorage()){
 const prefix=`paperplay:widgets:v2:${sourceId}:`;const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>!!key&&key.startsWith(prefix));keys.forEach(key=>storage.removeItem(key));forgetEnrichment(sourceId,storage);
 // Pending records keep their exact source and request capabilities for recovery.
 const automaticPrefix=`paperplay:automatic:v1:${sourceId}:`;const automaticKeys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>!!key&&key.startsWith(automaticPrefix));for(const key of automaticKeys){try{const raw=storage.getItem(key);if(raw&&new TextEncoder().encode(raw).length<=2_000_000){const state=automaticPaperStateSchema.parse(JSON.parse(raw));if(!state.pending)storage.removeItem(key);}}catch{/* Incompatible originals stay retained. */}}

 const records=await experiments.list(),owners=new Set(records.filter(record=>record.identity.source.documentId===sourceId).map(record=>artifactExperimentOwner(record.identity)));
 for(const owner of owners)await experiments.removeOwner(owner);
 // The generated-run cache is separate: never delete its pending paid-job capability here.
}
