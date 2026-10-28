import { validateArtifactInterface } from '../../shared/figure-interfaces';
import type { BuiltFigureArtifact } from './lifecycle';
import { hasCheckedAssetIntegrity } from '../assets/local';
/** Only manifest-declared checked assets enter the guest, never the reader/workspace object. */
export function figureRuntimeInput(built:BuiltFigureArtifact){if(built.manifest.kind!=='generated')throw Error('Expected generated source.');const manifest=built.manifest,input={...((manifest.initialInput??{}) as Record<string,unknown>)};
 if(manifest.interfaces.input.some(field=>field.id==='assets')){input.assets=Object.fromEntries(manifest.assetBindings.map(ref=>{const asset=built.assets?.find(asset=>asset.id===ref.id);if(!asset||!hasCheckedAssetIntegrity(asset)||asset.checksum.value!==ref.sha256)throw Error('Supply the exact declared checked data.');return [ref.id,asset];}));}
 validateArtifactInterface(input,manifest.interfaces.input,manifest.resources.maxInputBytes);return input;
}
