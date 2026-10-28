import { z } from 'zod';
import { figureArtifactSchema } from '../../shared/figure-artifacts';
import { sdkEventSchema } from '../../shared/figure-sdk';
import { evaluateGuestFrame } from '../../lib/artifacts/guest-engine';
const requestSchema=z.strictObject({instanceId:z.string().uuid(),artifact:figureArtifactSchema,input:z.unknown(),state:z.unknown(),event:sdkEventSchema});
let accepted=false;
self.onmessage=async event=>{
 if(accepted)return;accepted=true;
 const bytes=new TextEncoder().encode(JSON.stringify(event.data)).length;if(bytes>768*1024){self.postMessage({status:'rejected',reason:'Message budget'});return;}
 const parsed=requestSchema.safeParse(event.data);if(!parsed.success||parsed.data.artifact.kind!=='generated'){self.postMessage({status:'rejected',reason:'Request schema'});return;}
 const {instanceId,artifact,input,state,event:action}=parsed.data;
 try{const frame=await evaluateGuestFrame(artifact,input,state,action);self.postMessage({instanceId,status:'ready',frame});}catch{self.postMessage({instanceId,status:'failed',reason:'Guest error or resource policy'});}
};
