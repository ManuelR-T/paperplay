import { createHash } from 'node:crypto';
import { z } from 'zod';
import rawCorpus from '../../data/scientific-corpus.json';
import { representationRegistry } from '../representations/adapters';
import type { CapabilityRegistry } from '../representations/registry';
import type { CapabilityEnvironment } from '../../shared/representation-capabilities';
const line=z.string().trim().min(1).max(2000);
const domain=z.enum(['biology','physics','computer-science']);
const paper=z.strictObject({
 id:z.string().regex(/^[BPC][1-4]$/),domain,split:z.enum(['development','held-out']),title:line,researchKinds:z.array(z.enum(['empirical','mathematical','theoretical','computational','formal','algorithmic'])).min(1).max(3),authors:z.array(line).min(1).max(100),year:z.number().int().min(1600).max(2100),
 identifiers:z.strictObject({doi:line.nullable(),arxiv:line.nullable(),canonicalUrl:z.url()}),
 source:z.strictObject({edition:line,locator:line,admission:z.enum(['body-locator-inspected','abstract-inspected','metadata-only','institutional-locator-only']),checkedAt:z.iso.date(),inspectedUrl:z.url(),storedContentSha256:z.null(),contentStored:z.literal(false)}),
 rights:z.strictObject({license:line,storagePolicy:z.literal('metadata-and-links-only'),thirdPartyAssetsRequireReview:z.literal(true)}),
 concept:line,expected:z.strictObject({representation:z.enum(['process-map','spatial-field','data-exploration','pipeline','trajectory','argument','annotated-figure','derivation','algorithm-trace','tensor-exploration','state-machine']),evidence:z.literal('illustration'),scientificVerification:z.literal('not-evaluated'),expertReview:z.literal('pending'),requiredInputs:z.array(line).min(1),assumptions:z.array(line).min(1),omissions:z.array(line).min(1),behavior:z.array(line).min(1)}),
 crossDomains:z.array(domain).max(2),imageHeavy:z.boolean(),
});
export const scientificCorpusSchema=z.strictObject({format:z.literal('paperplay-scientific-corpus'),schemaVersion:z.literal(1),id:line,frozenAt:z.iso.date(),sourceBrief:line,splitSha256:z.string().regex(/^[a-f0-9]{64}$/),heldOutPolicy:line,papers:z.array(paper).min(12).max(100),scenarios:z.array(z.strictObject({id:line,paperId:line,intentionallyOmitted:z.array(line).min(1),reason:line,expectedFallback:line,forbiddenClaims:z.array(line).min(1)})).min(3)}).superRefine((value,ctx)=>{
 const ids=value.papers.map(p=>p.id),scenarioIds=value.scenarios.map(s=>s.id);
 if(new Set(ids).size!==ids.length||new Set(scenarioIds).size!==scenarioIds.length)ctx.addIssue({code:'custom',message:'Corpus IDs must be unique.'});
 for(const field of ['biology','physics','computer-science'])if(value.papers.filter(p=>p.domain===field).length<4)ctx.addIssue({code:'custom',message:`At least four ${field} papers are required.`});
 if(!value.papers.some(p=>p.split==='held-out')||!value.papers.some(p=>p.split==='development'))ctx.addIssue({code:'custom',message:'Both development and held-out splits are required.'});
 for(const s of value.scenarios)if(!ids.includes(s.paperId))ctx.addIssue({code:'custom',message:`Unknown scenario paper ${s.paperId}.`});
 const splitHash=createHash('sha256').update(value.papers.map(p=>`${p.id}:${p.split}`).sort().join('\n')).digest('hex');
 if(value.splitSha256!==splitHash)ctx.addIssue({code:'custom',message:'Frozen corpus membership/split digest changed; version and readmit the corpus deliberately.'});
});
export type ScientificCorpus=z.infer<typeof scientificCorpusSchema>;
export function readScientificCorpus(input:unknown=rawCorpus):ScientificCorpus{return scientificCorpusSchema.parse(input);}
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(item=>item===value).length]));
/** Intake conformance only. Does not invoke a model, run a paper, or admit unavailable source text. */
export function reportScientificCorpus(input:unknown=rawCorpus,registry:CapabilityRegistry=representationRegistry,environment:CapabilityEnvironment={facilities:['trusted-computation','asset-integrity'],offline:true}){
 const corpus=readScientificCorpus(input);
 const cases=corpus.papers.map(p=>{
   const selection=registry.select({behaviors:p.expected.behavior,assetKinds:[],interactions:[],inputBytes:0,requestedEvidence:p.expected.evidence},environment);
   const admitted=p.source.admission==='body-locator-inspected'||p.source.admission==='abstract-inspected';
   return {id:p.id,domain:p.domain,split:p.split,representation:p.expected.representation,requestedEvidence:p.expected.evidence,sourceAdmission:p.source.admission,
     sourceTextStored:false,expertReview:'pending',scientificVerification:'not-evaluated',executed:false,
     genericCapabilityCandidates:selection.candidates.map(c=>`${c.id}@${c.version}`),capabilityGaps:selection.gaps,
     sourceLinkedFallback:admitted?'Requires import of the exact inspected source passage before a reading guide can be built.':'Source passage admission required before any source-linked representation.',
     incompleteScenarios:corpus.scenarios.filter(s=>s.paperId===p.id).map(s=>s.id)};
 });
 return {format:'paperplay-scientific-corpus-intake-report',schemaVersion:1,corpusId:corpus.id,splitSha256:corpus.splitSha256,
   scope:'Twelve-case intake and adapter metadata conformance; not universal scientific coverage or scientific validation.',
   counts:{papers:cases.length,byDomain:count(cases.map(p=>p.domain)),bySplit:count(cases.map(p=>p.split)),byExpectedRepresentation:count(cases.map(p=>p.representation)),byRequestedEvidence:count(cases.map(p=>p.requestedEvidence)),bySourceAdmission:count(cases.map(p=>p.sourceAdmission)),incompleteScenarios:corpus.scenarios.length,executedPapers:0,independentlyVerifiedPapers:0,expertReviewedPapers:0,modelRuns:0,humanSessions:0},
   warning:'A generic catalog match is not a source-specific recipe, a completed representation, or evidence of reproduction.',cases,scenarios:corpus.scenarios};
}
