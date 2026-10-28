import type { ScientificAsset } from '../../shared/scientific-assets';
import type { SourceDocument } from '../../shared/schema';
import { hasCheckedAssetIntegrity } from './local';
/** Session-only references to checked assets; no persistence, upload or silent same-ID replacement. */
export function addApprovedAsset(current:readonly ScientificAsset[],asset:ScientificAsset,source:SourceDocument){
 if(!hasCheckedAssetIntegrity(asset))throw Error('Check these data before adding them.');const origin=asset.provenance.source;if(origin&&(origin.documentId!==source.id||origin.sourceVersion!==source.sourceVersion))throw Error('These data belong to another paper version.');const old=current.find(item=>item.id===asset.id);if(old&&old.checksum.value!==asset.checksum.value)throw Error('This data ID already has different content. Remove the old session asset or choose another ID.');
 const next=old?[...current]:[...current,asset];if(next.length>16||new TextEncoder().encode(JSON.stringify(next)).length>8*1024*1024)throw Error('The checked-data session is full (16 assets / 8 MiB). Remove an asset before adding more.');return next;
}
