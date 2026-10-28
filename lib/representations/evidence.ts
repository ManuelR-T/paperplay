import { z } from 'zod';
import type { RepresentationPlan } from '../../shared/representations';
import type { EvidenceDeclaration } from '../../shared/research-evidence';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const bindingsSchema=z.strictObject({assetHashes:z.record(z.string().min(1).max(100),digest),engineVersions:z.record(z.string().min(1).max(100),z.string().min(1).max(100)),artifactHash:digest.optional()});
export type ScientificBindings=z.infer<typeof bindingsSchema>;
export type ScientificCheck={id:string;subject:EvidenceDeclaration['subject'];level:'mechanism-reproduction'|'experiment-reproduction';reference:string;scope:string;run:()=>Promise<{passed:boolean;details:string}>};
export type ScientificReceipt={checkId:string;subject:EvidenceDeclaration['subject'];binding:string;level:ScientificCheck['level'];reference:string;scope:string;passed:boolean;details:string};
const trustedReceipts=new WeakSet<object>();
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}

/** Conservative scientific identity: view-only navigation does not invalidate a result. */
export async function scientificBinding(plan:RepresentationPlan,bindings:ScientificBindings={assetHashes:{},engineVersions:{}}):Promise<string> {
  const checked=bindingsSchema.parse(bindings);
  const identity={...plan,navigation:undefined,reportedChecks:undefined,views:plan.views.map(view=>view.kind==='widget'?{...view,widget:{...view.widget,view:undefined}}:view),bindings:checked};
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(identity)));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/** Application-owned checker seam. Imported JSON and model-written code cannot mint receipts. */
export async function runScientificCheck(plan:RepresentationPlan,check:ScientificCheck,bindings:ScientificBindings={assetHashes:{},engineVersions:{}}):Promise<ScientificReceipt> {
  const subjects=check.subject.kind==='claim'?plan.claims:check.subject.kind==='asset'?plan.assets:check.subject.kind==='quantity'?plan.quantities:plan.views;
  if(!subjects.some(subject=>subject.id===check.subject.id))throw Error('Scientific check subject is unavailable.');
  if(!check.id.trim()||!check.reference.trim()||!check.scope.trim())throw Error('A scientific check requires identity, an independent reference and an explicit scope.');
  const binding=await scientificBinding(plan,bindings);
  let outcome:{passed:boolean;details:string};try{outcome=await check.run();}catch(error){outcome={passed:false,details:error instanceof Error?error.message:'Scientific check failed.'};}
  const receipt=Object.freeze({checkId:check.id,subject:Object.freeze({...check.subject}),binding,level:check.level,reference:check.reference,scope:check.scope,passed:outcome.passed===true,details:outcome.details});
  trustedReceipts.add(receipt);return receipt;
}
export type SubjectEvidence={subject:EvidenceDeclaration['subject'];origins:EvidenceDeclaration['origin'][];label:string;checks:ScientificReceipt[];staleChecks:number};
export async function assessScientificEvidence(plan:RepresentationPlan,receipts:readonly unknown[]=[],bindings:ScientificBindings={assetHashes:{},engineVersions:{}}):Promise<SubjectEvidence[]> {
  const binding=await scientificBinding(plan,bindings);
  const subjects:EvidenceDeclaration['subject'][]=[...plan.claims.map(claim=>({kind:'claim' as const,id:claim.id})),...plan.assets.map(asset=>({kind:'asset' as const,id:asset.id})),...plan.quantities.map(quantity=>({kind:'quantity' as const,id:quantity.id})),...plan.views.map(view=>({kind:'view' as const,id:view.id}))];
  return subjects.map(subject=>{
    const declared=(plan.evidence??[]).filter(item=>item.subject.kind===subject.kind&&item.subject.id===subject.id);
    const origins=declared.map(item=>item.origin);
    const owned=receipts.filter((input):input is ScientificReceipt=>!!input&&typeof input==='object'&&trustedReceipts.has(input)&&((input as ScientificReceipt).subject.kind===subject.kind)&&((input as ScientificReceipt).subject.id===subject.id));
    const checks=owned.filter(receipt=>receipt.binding===binding),passed=checks.filter(receipt=>receipt.passed);
    const claim=plan.claims.find(claim=>subject.kind==='claim'&&claim.id===subject.id);
    const level=passed.some(check=>check.level==='experiment-reproduction')?'Experiment checked within recorded scope':passed.length?'Mechanism checked within recorded scope':null;
    const label=level??(claim?.kind==='source'?'Source quotation · interpretation not verified':claim?'Added explanation · not verified':subject.kind==='asset'||subject.kind==='quantity'?'Declared data origin · not verified':'Teaching representation · not independently verified');
    return {subject,origins,label,checks,staleChecks:owned.length-checks.length};
  });
}
