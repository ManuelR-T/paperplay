import { runtimeRequestSchema,assertBoundedFigureJson,type FigureRuntimeErrorCode } from '../../shared/figure-runtime';
import { canonicalArtifactJson } from '../../shared/figure-compilation';
import { validateArtifactInterface } from '../../shared/figure-interfaces';
import { FIGURE_SDK_SOURCE,sha256Text } from './sdk-source';
import { evaluateGuestFrame } from './guest-engine';
let accepted=false;
self.onmessage=async event=>{
 if(accepted)return;accepted=true;let instanceId:string|undefined,code:FigureRuntimeErrorCode='integrity';
 try{
   assertBoundedFigureJson(event.data,768*1024);const request=runtimeRequestSchema.parse(event.data);instanceId=request.instanceId;
   if(request.artifact.kind!=='generated')throw Error();const {artifact,compiled}=request;
   if(await sha256Text(JSON.stringify(artifact))!==compiled.manifestSha256||await sha256Text(artifact.entry.source)!==compiled.entry.sha256||artifact.entry.source!==compiled.entry.source||compiled.sdk.sha256!==await sha256Text(FIGURE_SDK_SOURCE)||request.compiledSha256!==await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(compiled)))throw Error();
   code='invalid-input';validateArtifactInterface(request.input,artifact.interfaces.input,artifact.resources.maxInputBytes);if(request.state!==null)validateArtifactInterface(request.state,artifact.interfaces.state,artifact.resources.maxStateBytes);
   code='execution';const frame=await evaluateGuestFrame(artifact,request.input,request.state,request.event,{seed:request.seed});code='invalid-output';validateArtifactInterface(frame.state,artifact.interfaces.state,artifact.resources.maxStateBytes);assertBoundedFigureJson(frame,artifact.resources.maxOutputBytes);
   self.postMessage({format:'paperplay-runtime-response',schemaVersion:1,instanceId,sequence:1,status:'ready',frame});
 }catch(error){if(code==='execution'&&error instanceof Error&&error.message!=='Guest execution failed or exceeded its resource policy.')code='invalid-output';if(instanceId)self.postMessage({format:'paperplay-runtime-response',schemaVersion:1,instanceId,sequence:1,status:'failed',code});}
};
