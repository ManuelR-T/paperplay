import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createArtifactGenerationHandlers } from '../server/artifact-generation/handlers';
import { createEnrichmentStore } from '../server/enrichment/store';
import { createSqliteUsageStore } from '../server/usage/store';
import { readMetaConfig } from '../server/meta/config';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { buildSourceSections } from '../lib/enrichment/sections';
import { canonicalArtifactJson } from '../shared/figure-compilation';
import { generationReplySchema, type GenerationReply } from '../shared/artifact-generation';
import { generationPromptCharacters, generationProviderText, generationProviderRequest, GENERATION_INSTRUCTIONS, generationModelOutputSchema, type ArtifactGenerationProvider } from '../server/artifact-generation/provider';
import type { ProviderResponse } from '../server/analysis/provider';
import { checkGeneratedCandidate } from '../lib/artifacts/generation-check';
import { compileFigureSource } from '../lib/artifacts/compiler-engine';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { FigureRuntimeError } from '../shared/figure-runtime';

const origin = 'http://localhost:3000';
function req(body: unknown, cookie?: string) { return new Request(`${origin}/api/artifact-generation/start`, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
async function fixture(t: { after(fn: () => void): void }, options: { maxAttempts?: number; persistent?: boolean; host?:boolean } = {}) {
  let clock = 10_000, enabled = true, starts = 0, retrieves = 0, cancels = 0;
  const fixture = await createDynamicSequenceArtifact();
  const source = fixture.source;
  const plan = { objective: 'Inspect a source-linked conceptual sequence.', mechanism: 'Add and remove stable illustrative items.', representation: 'conceptual', assumptions: ['Synthetic teaching values.'], missingDetails: ['No experimental protocol is claimed.'], interactions: ['Add or remove one item.'] };
  const output = { plan, title: fixture.artifact.title, anchor: { blockId: 'passage', page: 1, quote: source.blocks[0].kind === 'paragraph' ? source.blocks[0].text : '' }, sourceCode: fixture.artifact.entry.source, inputFields: [], stateFields: fixture.artifact.interfaces.state.map(field => ({ ...field, maxItems: field.maxItems ?? null })), initialInputJson: '{}', checks: ['Appending then removing retains the surviving item identity.'] };
  let startResponse: Partial<ProviderResponse> = { status: 'queued' }, retrieved: Partial<ProviderResponse> = { status: 'completed', output_text: JSON.stringify(output), usage: { input_tokens: 40, output_tokens: 60, total_tokens: 100 } };
  let startError: unknown;
  let startBarrier:Promise<void>|undefined;
  const directory = options.persistent ? mkdtempSync(join(tmpdir(), 'paperplay-generation-')) : undefined;
  const path = directory ? join(directory, 'paper.sqlite') : ':memory:';
  const store = createEnrichmentStore({ path, now: () => clock });
  const usage = createSqliteUsageStore({ path: ':memory:', now: () => clock });
  t.after(() => { store.close(); usage.close?.(); if (directory) rmSync(directory, { recursive: true, force: true }); });
  const provider: ArtifactGenerationProvider = { ...(options.host?{executionMode:'host' as const}:{}), async start() { starts++; if(startBarrier)await startBarrier; if (startError) throw startError; return { id: `resp_generation_${starts}`, ...startResponse }; }, async retrieve(id) { retrieves++; return { id, ...retrieved }; }, async cancel(id) { cancels++; return { id, status: 'cancelled' }; } };
  const dependencies = { getConfig: () => readMetaConfig({ MODEL_API_KEY: 'fake-generation-fixture', META_ANALYSIS_ENABLED: enabled ? 'true' : 'false' }), store, usage, provider: () => provider, signingSecret: 'generation-fixture-signing', now: () => clock };
  const handlers = createArtifactGenerationHandlers(dependencies);
  const prepareBody = { source, runId: randomUUID(), sectionId: buildSourceSections(source)[0].id, brief: 'Show this conceptual mechanism using a bounded sequence.', maxAttempts: options.maxAttempts ?? 3 };
  const prepared = await handlers.prepare(req(prepareBody)); assert.equal(prepared.status, 200);
  const initial = generationReplySchema.parse(await prepared.json());
  const cookie = prepared.headers.get('set-cookie')!.split(';')[0];
  const context = { source, sectionId: prepareBody.sectionId, brief: prepareBody.brief, run: initial.run };
  return { source, output, plan, path, store, usage, handlers, dependencies, cookie, initial, prepareBody, context, counts: () => ({ starts, retrieves, cancels }), advance: (ms: number) => { clock += ms; }, disable: () => { enabled = false; }, startResult: (value: Partial<ProviderResponse>) => { startResponse = value; }, retrievalResult: (value: Partial<ProviderResponse>) => { retrieved = value; }, failStart: (error: unknown) => { startError = error; }, holdStart: (barrier:Promise<void>)=>{startBarrier=barrier;} };
}

test('prepare is inference-free; accepted work deduplicates and recovers across handlers and creation cutoff', async t => {
  const f = await fixture(t); assert.deepEqual(f.counts(), { starts: 0, retrieves: 0, cancels: 0 });
  const body = { ...f.context, attempt: 1 };
  assert.equal((await f.handlers.start(req(body))).status, 403);
  const started = generationReplySchema.parse(await (await f.handlers.start(req(body, f.cookie))).json()); assert.equal(started.status, 'queued');
  const recreated = createArtifactGenerationHandlers(f.dependencies);
  const duplicate = generationReplySchema.parse(await (await recreated.start(req(body, f.cookie))).json()); assert.equal(duplicate.status, 'complete'); assert.equal(f.counts().starts, 1);
  f.disable(); const done = generationReplySchema.parse(await (await recreated.status(req(body, f.cookie))).json()); assert.equal(done.status, 'complete'); assert.equal(done.candidate!.artifact.authorship.kind, 'meta');
  assert.equal(done.candidate!.artifact.kind, 'generated');
  const artifact = done.candidate!.artifact; if (artifact.kind === 'generated') { assert.equal(artifact.provenance.evidence, 'unverified'); assert.equal(artifact.provenance.origin, 'model-authored'); assert.deepEqual(artifact.assetIds, []); }
  assert.equal(done.paperBudget!.accountedTokens, 100); assert.equal(done.paperBudget!.requests, 1);
  assert.equal((await recreated.start(req(body, f.cookie))).status, 200); assert.equal(f.counts().starts, 1);
});

test('source, brief, model capability and ownership are bound before retrieval or paid creation', async t => {
  const f = await fixture(t); const body = { ...f.context, attempt: 1 };
  assert.equal((await f.handlers.start(req({ ...body, brief: 'A changed scope' }, f.cookie))).status, 409);
  assert.equal((await f.handlers.start(req({ ...body, source: { ...f.source, title: 'Changed' } }, f.cookie))).status, 409);
  assert.equal((await f.handlers.start(req({ ...body, run: { ...f.initial.run, model: 'different-model' } }, f.cookie))).status, 403);
  const other = await f.handlers.prepare(req({ ...f.prepareBody, runId: randomUUID() })); const otherCookie = other.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await f.handlers.start(req(body, otherCookie))).status, 403);
  const foreign = new Request('http://localhost:3000/api/artifact-generation/start', { method: 'POST', headers: { origin: 'https://foreign.example', 'content-type': 'application/json', cookie: f.cookie }, body: JSON.stringify(body) });
  assert.equal((await f.handlers.start(foreign)).status, 403); assert.equal(f.counts().starts, 0);
});

test('three sequential attempts are a hard durable maximum; malformed output is paid but never activated', async t => {
  const f = await fixture(t); f.startResult({ status: 'completed', output_text: '{invalid', usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } });
  for (let attempt = 1; attempt <= 3; attempt++) { const response = await f.handlers.start(req({ ...f.context, attempt }, f.cookie)); assert.equal(response.status, 200); const result = generationReplySchema.parse(await response.json()); assert.equal(result.status, 'failed'); assert.equal(result.candidate, undefined); assert.equal(result.budget.attemptsClaimed, attempt); }
  const run = f.store.generationRun(f.initial.run.runId, await owner(f));
  assert.equal(f.counts().starts, 3); assert.equal(f.store.budget(run.owner, run.documentHash).requests, 3);
  const reply = await (await f.handlers.start(req({ ...f.context, attempt: 4 }, f.cookie))).json(); assert.ok(reply.error); assert.equal(f.counts().starts, 3);
});
async function owner(f: Awaited<ReturnType<typeof fixture>>) { const { verifyToken, signingKey } = await import('../server/analysis/security'); return verifyToken(f.initial.run.token, signingKey('fake-generation-fixture', 'generation-fixture-signing')).owner as string; }

test('chosen one-attempt ceiling and five-minute expiry block new paid work but preserve retrieval', async t => {
  const f = await fixture(t, { maxAttempts: 1 }); await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie));
  assert.equal((await (await f.handlers.start(req({ ...f.context, attempt: 2 }, f.cookie))).json()).status, 'exhausted');
  f.advance(300_000); const result = await f.handlers.status(req({ ...f.context, attempt: 1 }, f.cookie)); assert.equal((await result.json()).status, 'complete'); assert.equal(f.counts().starts, 1);
  const other = await f.handlers.prepare(req({ ...f.prepareBody, runId: randomUUID() }, f.cookie)); const run = (await other.json()).run; f.advance(300_000);
  assert.equal((await (await f.handlers.start(req({ ...f.context, run, attempt: 1 }, f.cookie))).json()).status, 'expired'); assert.equal(f.counts().starts, 1);
});

test('repairs bind exact candidate and accept only actionable sanitized local diagnostics', async t => {
  const f = await fixture(t); f.startResult({ status: 'completed', output_text: JSON.stringify(f.output) });
  const first = await (await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie))).json() as GenerationReply; assert.equal(first.status, 'complete');
  const previous = first.candidate!;
  assert.equal(previous.sha256, createHash('sha256').update(canonicalArtifactJson({ plan: previous.plan, artifact: previous.artifact })).digest('hex'));
  const feedback = { candidateSha256: previous.sha256, compiler: { status: 'rejected', diagnostics: [{ code: 'syntax', position: 4 }] }, runtime: { status: 'not-run' } };
  assert.equal((await f.handlers.start(req({ ...f.context, attempt: 2, previous: { ...previous, plan: { ...previous.plan, objective: 'Tampered' } }, feedback }, f.cookie))).status, 409);
  assert.equal((await f.handlers.start(req({ ...f.context, attempt: 2, previous, feedback: { ...feedback, compiler: { status: 'unavailable', diagnostics: [] } } }, f.cookie))).status, 400);
  assert.equal((await f.handlers.start(req({ ...f.context, attempt: 2, previous, feedback: { ...feedback, privateStack: 'secret diagnostic' } }, f.cookie))).status, 400);
  const repair = await f.handlers.start(req({ ...f.context, attempt: 2, previous, feedback }, f.cookie)); assert.equal(repair.status, 200); assert.equal((await repair.json()).status, 'complete'); assert.equal(f.counts().starts, 2);
});

test('ambiguous submission cannot advance repair, retry paid creation or release conservative charge', async t => {
  const f = await fixture(t); f.failStart(Error('private transport internals'));
  const body = { ...f.context, attempt: 1 }; const first = await f.handlers.start(req(body, f.cookie)); assert.equal(first.status, 504); const error = await first.json(); assert.equal(error.uncertain, true); assert.doesNotMatch(error.error, /private/);
  const duplicate = await f.handlers.start(req(body, f.cookie)); assert.equal((await duplicate.json()).status, 'uncertain');
  assert.equal((await f.handlers.start(req({ ...body, attempt: 2 }, f.cookie))).status, 409); assert.equal(f.counts().starts, 1);
  const summary = await f.usage.summary(); assert.ok(summary.accountedTokens > 0);
});

test('cancel closes run without creating work and cancels only the accepted provider job', async t => {
  const f = await fixture(t); await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie));
  const cancelled = await f.handlers.cancel(req({ run: f.initial.run }, f.cookie)); assert.equal((await cancelled.json()).status, 'cancelled');
  assert.equal((await (await f.handlers.start(req({ ...f.context, attempt: 2 }, f.cookie))).json()).status, 'cancelled'); assert.deepEqual(f.counts(), { starts: 1, retrieves: 0, cancels: 1 });
});

test('paper quota includes existing catalog requests and global reservation fails before provider creation', async t => {
  const f = await fixture(t); const run = f.store.generationRun(f.initial.run.runId, await owner(f));
  for (let i = 0; i < 8; i++) f.store.reserve({ id: createHash('sha256').update(`catalog-${i}`).digest('hex'), owner: run.owner, documentHash: run.documentHash, contextHash: 'a'.repeat(64), action: 'plan', sectionId: run.sectionId, reservedTokens: 100 });
  assert.equal((await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie))).status, 429); assert.equal(f.counts().starts, 0);
  const other = await fixture(t); const limited = createSqliteUsageStore({ path: ':memory:', limits: { globalHourlyRequests: 20, sessionTenMinuteRequests: 5, dailyRequests: 100, dailyTokens: 1 } }); t.after(() => limited.close?.());
  const handler = createArtifactGenerationHandlers({ ...other.dependencies, usage: limited }); assert.equal((await handler.start(req({ ...other.context, attempt: 1 }, other.cookie))).status, 429); assert.equal(other.counts().starts, 0);
});

test('durable metadata excludes source/code/brief and duplicate claims across connections never create another attempt', async t => {
  const f = await fixture(t, { persistent: true }); await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie));
  const second = createEnrichmentStore({ path: f.path }); t.after(() => second.close());
  const handler = createArtifactGenerationHandlers({ ...f.dependencies, store: second }); await handler.start(req({ ...f.context, attempt: 1 }, f.cookie)); assert.equal(f.counts().starts, 1);
  const db = new DatabaseSync(f.path); const records = JSON.stringify([db.prepare('SELECT record FROM artifact_generation_runs').all(), db.prepare('SELECT record FROM enrichment_records').all()]); db.close();
  assert.doesNotMatch(records, /Show this conceptual mechanism|function update|This authored sequence|paperplay-figure-artifact|generation-fixture-signing/);
});

test('complete final prompt accounting includes instructions, SDK frame grammar and response schema', async t => {
  const f = await fixture(t); const input = { context: JSON.stringify({ selectedPassages: [] }), brief: 'Synthetic bounded sequence.', attempt: 1 };
  assert.ok(generationPromptCharacters(input) > generationProviderText(input).length + GENERATION_INSTRUCTIONS.length);
  assert.ok(generationProviderText(input).includes('coordinateSpace')); generationModelOutputSchema.parse(f.output);
  assert.equal((await f.handlers.start(req({ ...f.context, attempt: 2 }, f.cookie))).status, 409); assert.equal(f.counts().starts, 0);
});

test('repair rejects actual serialized prompt overflow before reserving another paid call', async t => {
  const f = await fixture(t); f.startResult({ status: 'completed', output_text: JSON.stringify({ ...f.output, sourceCode: '\u0001'.repeat(14000) }) });
  const first = await (await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie))).json() as GenerationReply; assert.equal(first.status, 'complete');
  const previous = first.candidate!;
  const feedback = { candidateSha256: previous.sha256, compiler: { status: 'rejected', diagnostics: [{ code: 'syntax' }] }, runtime: { status: 'not-run' } };
  const second = await f.handlers.start(req({ ...f.context, attempt: 2, previous, feedback }, f.cookie)); assert.equal(second.status, 400); assert.match((await second.json()).error, /complete generation prompt/); assert.equal(f.counts().starts, 1);
  assert.equal(f.store.generationRun(f.initial.run.runId, await owner(f)).attempts.length, 1);
});

test('simultaneous identical starts share one paid call while another connection cannot claim next active attempt', async t => {
  const f = await fixture(t);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); const started = new Promise<void>(resolve => { entered = resolve; }); let calls = 0;
  const adapter: ArtifactGenerationProvider = { async start() { calls++; entered(); await gate; return { id: 'resp_concurrent', status: 'queued' }; }, async retrieve(id) { return { id, status: 'queued' }; }, async cancel(id) { return { id, status: 'cancelled' }; } };
  const handlers = createArtifactGenerationHandlers({ ...f.dependencies, provider: () => adapter });
  const first = handlers.start(req({ ...f.context, attempt: 1 }, f.cookie)); await started;
  const duplicate = handlers.start(req({ ...f.context, attempt: 1 }, f.cookie));
  const next = await handlers.start(req({ ...f.context, attempt: 2 }, f.cookie)); assert.equal(next.status, 409);
  release(); assert.equal((await first).status, 200); assert.equal((await duplicate).status, 200); assert.equal(calls, 1);
});

test('invalid completed source anchors and extra model fields never become candidates', async t => {
  const f = await fixture(t); f.startResult({ status: 'completed', output_text: JSON.stringify({ ...f.output, anchor: { ...f.output.anchor, quote: 'This quotation is invented.' } }) });
  const first = await (await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie))).json(); assert.equal(first.status, 'failed'); assert.equal(first.candidate, undefined);
  f.startResult({ status: 'completed', output_text: JSON.stringify({ ...f.output, serverCommand: 'forbidden' }) });
  const second = await (await f.handlers.start(req({ ...f.context, attempt: 2 }, f.cookie))).json(); assert.equal(second.status, 'failed'); assert.equal(second.candidate, undefined); assert.equal(f.counts().starts, 2);
});

test('fake provider novel polymer candidate passes actual compiler and restricted interpreter smoke scenarios', async t => {
  const f = await fixture(t);
  const code = `function update(input,previous,event){
    const state=previous||{length:2,selected:0};let length=state.length,selected=state.selected;
    if(event.kind==='control'&&event.id==='length')length=event.value;
    if(event.kind==='control'&&event.id==='bind')length=Math.min(8,length+1);
    if(event.kind==='entity')selected=Number(event.id.slice(4));
    const marks=[];for(let i=0;i<length;i++){const x=30+i*50;if(i)marks.push(sdk.line({id:'bond'+i,from:[x-50,40],to:[x,40],label:'Illustrative bond'}));marks.push(sdk.circle({id:'unit'+i,entityId:'site'+i,anchorId:'passage',center:[x,40],radius:14,label:'Synthetic monomer '+i}));}
    return sdk.frame({title:'Illustrative polymer binding',description:'Synthetic bounded units; no observed chemistry or physical units.',coordinateSpace:{width:420,height:80},marks:marks,controls:[sdk.slider({id:'length',label:'Synthetic length',min:1,max:8,step:1,value:length}),sdk.button({id:'bind',label:'Bind one synthetic unit',disabled:length>=8})],table:{caption:'Authored structural values',columns:['Length','Selected site'],rows:[[length,selected]]},state:{length:length,selected:selected}});
  }`;
  f.startResult({ status: 'completed', output_text: JSON.stringify({ ...f.output, title: 'Illustrative polymer binding', sourceCode: code, plan: { ...f.plan, mechanism: 'A synthetic polymer grows by binding one illustrative unit; this is an authored analogy, not a mechanism asserted by the source.', assumptions: ['Authored polymer analogy over the source sequence; no scientific reproduction.'] }, stateFields: [{ id: 'length', kind: 'number', description: 'Synthetic length from one to eight', maxItems: null }, { id: 'selected', kind: 'number', description: 'Selected synthetic unit index', maxItems: null }] }) });
  const generated = generationReplySchema.parse(await (await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie))).json()); assert.equal(generated.status, 'complete'); assert.equal(generated.candidate!.artifact.kind, 'generated');
  assert.equal(generated.candidate!.artifact.resources.maxExecutionMs, 100);
  // This finite-program conformance fixture uses the same one-second Node reference
  // allowance as the other interpreter tests, independently of the production policy.
  // Actual deadline enforcement has separate runaway-program/worker tests.
  const checked = await checkGeneratedCandidate(generated.candidate!, f.source, { compile: request => compileFigureSource(request, readFileSync('node_modules/acorn/dist/acorn.js', 'utf8')), adapter: () => ({ id: 'restricted-test-interpreter', async execute(artifact,input,state,event) { try { return await evaluateGuestFrame({...artifact,resources:{...artifact.resources,maxExecutionMs:1000}},input,state,event); } catch { throw new FigureRuntimeError('execution'); } } }) });
  assert.equal(checked.feedback.compiler.status, 'ready'); assert.equal(checked.feedback.runtime.status, 'ready'); assert.equal(checked.repairable, false, JSON.stringify(checked.feedback));
  assert.deepEqual(checked.checks.filter(check => check.status === 'passed').map(check => check.id), ['manifest','compiler','initialize','slider-min','slider-max','button','entity','quality']);
  assert.equal(checked.checks.find(check => check.id === 'evidence')?.status, 'skipped');
  assert.equal(generated.candidate!.artifact.kind === 'generated' && generated.candidate!.artifact.provenance.evidence, 'unverified'); assert.equal(f.counts().starts, 1);
});

test('late queued or cancelled reports preserve terminal artifact metadata and measured paper charge', async t => {
  const f = await fixture(t); f.startResult({ status: 'completed', output_text: JSON.stringify(f.output), usage: { input_tokens: 40, output_tokens: 60, total_tokens: 100 } });
  await f.handlers.start(req({ ...f.context, attempt: 1 }, f.cookie));
  const run = f.store.generationRun(f.initial.run.runId, await owner(f)); const record = f.store.generationAttempt(run.runId, run.owner, 1); const candidateHash = run.attempts[0].candidateSha256;
  f.retrievalResult({ status: 'queued', usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } });
  const stale = await (await f.handlers.status(req({ ...f.context, attempt: 1 }, f.cookie))).json(); assert.equal(stale.status, 'uncertain');
  f.store.settle(record.id, { status: 'cancelled', actualTokens: 0 });
  const retained = f.store.generationAttempt(run.runId, run.owner, 1); assert.equal(retained.status, 'completed'); assert.equal(retained.actualTokens, 100); assert.equal(f.store.budget(run.owner, run.documentHash).accountedTokens, 100); assert.equal(f.store.generationRun(run.runId, run.owner).attempts[0].candidateSha256, candidateHash);
});

test('quality repair accepts bounded artifact diagnostics but never pays to repair host layout',async t=>{
 const f=await fixture(t);f.startResult({status:'completed',output_text:JSON.stringify(f.output)});
 const first=generationReplySchema.parse(await(await f.handlers.start(req({...f.context,attempt:1},f.cookie))).json());const previous=first.candidate!;
 const feedback={candidateSha256:previous.sha256,compiler:{status:'ready',diagnostics:[]},runtime:{status:'ready'},quality:{status:'failed',diagnostics:[{code:'text-clipped',scope:'artifact',step:0,markIndex:0}],framesChecked:1,textMeasurements:'provided'}};
 const host={...feedback,quality:{...feedback.quality,diagnostics:[{code:'small-target',scope:'host',step:0}]}};
 assert.equal((await f.handlers.start(req({...f.context,attempt:2,previous,feedback:host},f.cookie))).status,400);assert.equal(f.counts().starts,1);
 const rawText={...feedback,quality:{...feedback.quality,diagnostics:[{...feedback.quality.diagnostics[0],labelText:'private label must not reach the model'}]}};
 assert.equal((await f.handlers.start(req({...f.context,attempt:2,previous,feedback:rawText},f.cookie))).status,400);assert.equal(f.counts().starts,1);
 assert.equal((await f.handlers.start(req({...f.context,attempt:2,previous,feedback},f.cookie))).status,200);assert.equal(f.counts().starts,2);
});


test('generated response schema restricts anchor locators to selected literal block IDs and pages',()=>{
 const context=JSON.stringify({selectedPassages:[{blockId:'selected-paragraph',page:2,text:'An exact selected teaching passage.'},{blockId:'selected-equation',page:7,text:'Another selected passage.'},{blockId:'selected-paragraph',page:2,text:'A second segment.'}],neighboringContext:[{blockId:'neighbor-only',page:9,text:'Not selected coverage.'}]});
 const request=generationProviderRequest({context,brief:'Explain the selected mechanism.',attempt:1});
 const anchor=(request.text.format.schema as any).properties.anchor.properties;
 assert.deepEqual(anchor.blockId.enum,['selected-paragraph','selected-equation']);assert.deepEqual(anchor.page.enum,[2,7]);
 assert.equal(anchor.blockId.enum.includes('invented-block'),false);assert.equal(anchor.blockId.enum.includes('neighbor-only'),false);assert.equal(anchor.page.enum.includes(9),false);
 assert.match(request.instructions,/copy.*blockId.*literally/i);assert.match(request.instructions,/previous is null/i);
});

test('a generated quote with an invented block ID remains rejected even when the quoted text exists',async t=>{
 const f=await fixture(t);f.startResult({status:'completed',output_text:JSON.stringify({...f.output,anchor:{...f.output.anchor,blockId:'invented-block'}})});
 const response=await f.handlers.start(req({...f.context,attempt:1},f.cookie)),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.status,'failed');assert.equal(body.candidate,undefined);assert.match(body.error,/artifact\/source validation/);assert.equal(f.counts().starts,1);
});

test('pre-provider quota rejection reclaims the same custom run and attempt without multiplying its budget',async t=>{
 const {UsageQuotaError}=await import('../server/usage/model');const f=await fixture(t,{maxAttempts:1});let deny=true;
 const handlers=createArtifactGenerationHandlers({...f.dependencies,usage:{...f.usage,reserve:async input=>{if(deny){deny=false;throw new UsageQuotaError('session-rate',11_000);}return f.usage.reserve(input);}}});
 const body={...f.context,attempt:1},denied=await handlers.start(req(body,f.cookie));assert.equal(denied.status,429);assert.equal((await denied.json()).quota.reason,'session-rate');assert.equal(f.counts().starts,0);
 const accepted=await handlers.start(req(body,f.cookie));assert.equal(accepted.status,200);const reply=await accepted.json();assert.equal(reply.status,'queued');assert.equal(reply.budget.attemptsClaimed,1);assert.equal(f.counts().starts,1);
 assert.equal((await handlers.start(req(body,f.cookie))).status,200);assert.equal(f.counts().starts,1);
});


test('host foreground generation returns immediately and polls the same attempt until its real response arrives',async t=>{
  const f=await fixture(t,{host:true});let release!:()=>void;f.holdStart(new Promise<void>(resolve=>{release=resolve;}));
  f.startResult({status:'completed',output_text:JSON.stringify(f.output)});
  const body={...f.context,attempt:1};
  const started=generationReplySchema.parse(await(await f.handlers.start(req(body,f.cookie))).json());
  assert.equal(started.status,'queued');assert.equal(f.counts().starts,1);
  const pending=generationReplySchema.parse(await(await f.handlers.status(req(body,f.cookie))).json());
  assert.equal(pending.status,'analyzing');assert.equal(f.counts().retrieves,0);
  const duplicate=generationReplySchema.parse(await(await f.handlers.start(req(body,f.cookie))).json());
  assert.equal(duplicate.status,'analyzing');assert.equal(f.counts().starts,1);
  // Another host cannot invent an accepted provider ID while the original request is running.
  const other=createArtifactGenerationHandlers(f.dependencies);
  const interrupted=generationReplySchema.parse(await(await other.status(req(body,f.cookie))).json());
  assert.equal(interrupted.status,'uncertain');assert.equal(f.counts().starts,1);
  release();await new Promise(resolve=>setImmediate(resolve));
  const complete=generationReplySchema.parse(await(await f.handlers.status(req(body,f.cookie))).json());
  assert.equal(complete.status,'complete');assert.ok(complete.candidate);assert.equal(f.counts().starts,1);assert.equal(f.counts().retrieves,0);
  const reopened=generationReplySchema.parse(await(await other.status(req(body,f.cookie))).json());
  assert.equal(reopened.status,'complete');assert.equal(f.counts().starts,1);assert.equal(f.counts().retrieves,1);
});

test('host foreground generation exposes a submission failure through polling without creating another attempt',async t=>{
  const f=await fixture(t,{host:true});let release!:()=>void;f.holdStart(new Promise<void>(resolve=>{release=resolve;}));f.failStart(new Error('Simulated network loss after submission'));
  const body={...f.context,attempt:1};
  const started=generationReplySchema.parse(await(await f.handlers.start(req(body,f.cookie))).json());assert.equal(started.status,'queued');
  release();await new Promise(resolve=>setImmediate(resolve));
  const result=await f.handlers.status(req(body,f.cookie));assert.equal(result.status,504);assert.equal((await result.json()).uncertain,true);
  const duplicate=await f.handlers.start(req(body,f.cookie));assert.equal(duplicate.status,504);assert.equal(f.counts().starts,1);
});

test('the production generation request uses foreground Meta execution rather than the unsupported provider background mode',()=>{
  const request=generationProviderRequest({context:JSON.stringify({selectedPassages:[{blockId:'p',page:1,text:'A source passage for a learning interaction.'}]}),brief:'Explain the relationship.',attempt:1});
  assert.equal(request.background,false);
});

test('an unexpected queued foreground response is polled through its real provider ID rather than cached as terminal',async t=>{
  const f=await fixture(t,{host:true}),body={...f.context,attempt:1};
  const started=generationReplySchema.parse(await(await f.handlers.start(req(body,f.cookie))).json());assert.equal(started.status,'queued');
  await new Promise(resolve=>setImmediate(resolve));
  const complete=generationReplySchema.parse(await(await f.handlers.status(req(body,f.cookie))).json());
  assert.equal(complete.status,'complete');assert.equal(f.counts().retrieves,1);assert.equal(f.counts().starts,1);
});
