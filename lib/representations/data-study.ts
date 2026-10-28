import { z } from 'zod';
import { sourceDocumentSchema,validateDocument,type SourceDocument } from '../../shared/schema';
import { representationPlanSchema,validateRepresentationPlan,type RepresentationPlan } from '../../shared/representations';
import { validateScientificAsset } from '../assets/local';
import { buildRepresentation } from './lifecycle';
export const MAX_DATA_STUDY_BYTES=512*1024;
const schema=z.strictObject({format:z.literal('paperplay-data-study'),version:z.union([z.literal(1),z.literal(2)]),source:sourceDocumentSchema,representation:representationPlanSchema});
export async function parseDataStudy(text:string){
 if(new TextEncoder().encode(text).length>MAX_DATA_STUDY_BYTES)throw Error('Choose a data study below 512 KiB.');
 const raw=schema.parse(JSON.parse(text)),source=validateDocument(raw.source),plan=validateRepresentationPlan(raw.representation,source);
 if(raw.version===1&&(plan.views.length!==1||plan.views[0].kind!=='statistical-chart'))throw Error('This data-study format requires one statistical-chart view.');
 const assets=await Promise.all((plan.assetManifests??[]).map(asset=>validateScientificAsset(asset,source)));
 const built=buildRepresentation(plan,source,{assets});if(built.status!=='ready')throw Error(`${built.reason} ${built.nextAction}`);
 return {source,plan,assets};
}
export function serializeDataStudy(source:SourceDocument,representation:RepresentationPlan){
 const data=schema.parse({format:'paperplay-data-study',version:representation.views.length===1&&representation.views[0].kind==='statistical-chart'?1:2,source:validateDocument(source),representation:validateRepresentationPlan(representation,source)}),text=JSON.stringify(data,null,2);
 if(new TextEncoder().encode(text).length>MAX_DATA_STUDY_BYTES)throw Error('This data study exceeds 512 KiB; keep the checked assets separately.');return text;
}
