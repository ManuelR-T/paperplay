import {hasCheckedAssetIntegrity} from '../assets/local';
import {validateMolecularGeometry} from '../../shared/molecular-geometry';
/** Original-coordinate Euclidean distance, independent of the display camera; no bond/uncertainty inference. */
export function measureAtomDistance(asset:unknown,firstAtomId:string,secondAtomId:string,options:{frame?:string}={}){
 if(!hasCheckedAssetIntegrity(asset))throw Error('Distance needs an integrity-checked coordinate asset.');
 const m=validateMolecularGeometry(asset),a=m.atoms.find(atom=>atom.id===firstAtomId),b=m.atoms.find(atom=>atom.id===secondAtomId);
 if(!a||!b||a.modelId!==b.modelId||options.frame!==undefined&&options.frame!==m.frame)throw Error('Distance endpoints must share the exact original model and coordinate frame.');
 if(a.altLoc.trim()&&b.altLoc.trim()&&a.altLoc!==b.altLoc)throw Error('This adapter does not compare different nonblank alternate-location labels.');
 const distanceAngstrom=Math.hypot(...a.sourceCoordinates.map((v,i)=>v-b.sourceCoordinates[i]));
 return {atomIds:[a.id,b.id] as [string,string],sourceSha256:m.source.sha256,modelId:a.modelId,frame:m.frame,distanceAngstrom,distanceNm:distanceAngstrom*.1};
}
