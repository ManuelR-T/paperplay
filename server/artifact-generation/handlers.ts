import {createArtifactGenerationRuntime,type ArtifactGenerationRuntime} from './runtime';
import {readAdoptionPolicy} from '../../shared/adoption';
import {retrieveCapabilities,generationRetrievalQuery} from '../../lib/retrieval/selection';
import {createCapabilitySelectionReceipt,validateCapabilitySelectionReceipt} from '../../lib/retrieval/manifest';
import type {ModelRequestAccounting} from '../../shared/capability-retrieval';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { GENERATION_POLICY, generationInputCharacterLimit, generationPrepareSchema, generationStartSchema, generationStatusSchema, generationCancelSchema, type GenerationReply, type GenerationRunRef, type GenerationCandidate } from '../../shared/artifact-generation';
import { canonicalArtifactJson } from '../../shared/figure-compilation';
import { validateFigureArtifact } from '../../shared/figure-artifacts';
import { validateDocument } from '../../shared/schema';
import { wholePaperContext, WHOLE_PAPER_SECTION_ID } from '../../lib/enrichment/whole-paper';
import { sectionContext, sourceBlockText } from '../../lib/enrichment/sections';
import { FIGURE_SDK_SOURCE } from '../../lib/artifacts/sdk-source';
import { AnalysisHttpError, requireSameOrigin, sessionFor, signingKey, signToken, verifyToken } from '../analysis/security';
import { safeProviderError, type ProviderResponse } from '../analysis/provider';
import { getUsageStore } from '../usage/service';
import { reservedTokensFor, usageIdFor, usageQuotaResponse, type UsageStore } from '../usage/model';
import { getEnrichmentStore, type EnrichmentStore, type GenerationRunRecord, type EnrichmentRecord } from '../enrichment/store';
import type { MetaConfig } from '../meta/config';
import { createArtifactGenerationProvider, generationModelOutputSchema, generationPromptCharacters,generationProviderRequest,generationInstructions,generationPromptMetrics,validateGeneratedMethodSelection,type ArtifactGenerationProvider, type GenerationProviderInput } from './provider';

const hash = (value: unknown) => createHash('sha256').update(canonicalArtifactJson(value)).digest('hex');
const textHash = (text: string) => createHash('sha256').update(text).digest('hex');
const providerId = /^resp_[a-zA-Z0-9_-]{1,250}$/;
type Context = z.infer<typeof generationPrepareSchema> | z.infer<typeof generationStartSchema> | z.infer<typeof generationStatusSchema>;
type Dependencies = { runtime?:ArtifactGenerationRuntime; getConfig: () => MetaConfig; store?: EnrichmentStore; usage?: UsageStore; provider?: (config: MetaConfig) => ArtifactGenerationProvider; signingSecret?: string; allowedOrigin?: string; now?: () => number };
async function readJson(request: Request) {
  const max = 2_500_000;
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AnalysisHttpError(415, 'Generation requires JSON.');
  if (!request.body || Number(request.headers.get('content-length') || 0) > max) throw new AnalysisHttpError(413, 'Generation transport exceeds 2.5 MB.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const result = await reader.read(); if (result.done) break; size += result.value.byteLength; if (size > max) { await reader.cancel(); throw new AnalysisHttpError(413, 'Generation transport exceeds 2.5 MB.'); } chunks.push(result.value); } try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { throw new AnalysisHttpError(400, 'Generation JSON is invalid.'); } } finally { reader.releaseLock(); }
}
export function createArtifactGenerationHandlers(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const store = () => dependencies.store ?? getEnrichmentStore();
  const usage = () => dependencies.usage ?? getUsageStore();
  const provider = dependencies.provider ?? createArtifactGenerationProvider;
  const {running,finished}=dependencies.runtime??createArtifactGenerationRuntime();
  // Foreground Meta calls run on this host while the browser polls its durable run/attempt.
  // Store only real provider IDs in the ledger; an interrupted host call stays unresolved.
  function remember(id:string,value:{value?:GenerationReply;error?:unknown}){finished.set(id,value);if(finished.size>32)finished.delete(finished.keys().next().value!);}

  const json = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
  const fail = (error: unknown) => { const safe = error instanceof AnalysisHttpError ? error : error instanceof Error&&error.message==='Model request body exceeds its measurement ceiling.' ? new AnalysisHttpError(413,'The complete paper and generation instructions exceed the supported request size. No source text was removed and no model request was sent.') : new AnalysisHttpError(400, 'The generation request or result failed bounded validation. Previous figures are retained.'); const quota=usageQuotaResponse(safe);return Response.json({error:safe.message,uncertain:safe.uncertain,...(quota?{quota:quota.quota}:{})},{status:safe.status,headers:{'Cache-Control':'no-store',...quota?.headers}}); };
  function configFor(request: Request, createSession = false) {
    requireSameOrigin(request, dependencies.allowedOrigin); const config = dependencies.getConfig();
    if (!config.apiKey) throw new AnalysisHttpError(503, 'Meta generation is not configured. Existing figures remain available.');
    const key = signingKey(config.apiKey, dependencies.signingSecret);
    return { config, key, session: sessionFor(request, key, now(), createSession) };
  }
  async function context(input: Context, model: string,frozen?:GenerationRunRecord) {
    const source = validateDocument(input.source);
    if(input.scope==='paper'){
      if(input.sectionId!==WHOLE_PAPER_SECTION_ID||!input.anchor)throw new AnalysisHttpError(400,'Whole-paper generation requires its selected figure anchor.');
      const block=source.blocks.find(block=>block.id===input.anchor!.blockId),norm=(text:string)=>text.replace(/\s+/g,' ').trim();
      if(!block||block.page!==input.anchor.page||!norm(sourceBlockText(block)).includes(norm(input.anchor.quote)))throw new AnalysisHttpError(400,'The selected figure anchor does not belong to this complete paper.');
    }else if(input.anchor)throw new AnalysisHttpError(400,'A selected whole-paper anchor requires paper scope.');
    const selected = input.scope==='paper'?wholePaperContext(source):sectionContext(source, input.sectionId);
    // Match the existing catalog ledger identity byte-for-byte to share its allowance.
    const documentHash = textHash(JSON.stringify({ ...source, anchors: [] }));
    const query=await generationRetrievalQuery({...input,source});
    const legacy=!!frozen&&!frozen.retrieval,selection=frozen?undefined:await retrieveCapabilities(query);let retrieval;try{retrieval=frozen?.retrieval?await validateCapabilitySelectionReceipt(frozen.retrieval,query):legacy?undefined:await createCapabilitySelectionReceipt(selection!);}catch{throw new AnalysisHttpError(409,'Source, section and brief are frozen for this generation run.');}
    if(input.retrievalSelectionSha256&&input.retrievalSelectionSha256!==retrieval?.selectionSha256)throw new AnalysisHttpError(409,'The reviewed capability selection differs from this frozen run.');
    const promptContractSha256=frozen?.promptContractSha256??hash({instructions:generationInstructions(input),schema:generationProviderRequest({context:selected.text,brief:input.brief,attempt:1,...(input.scope==='paper'?{scope:input.scope,anchor:input.anchor}:{})}).text.format.schema}),sdkSha256=frozen?.sdkSha256??textHash(FIGURE_SDK_SOURCE);
    const contextHash=hash({documentHash,selected:selected.text,brief:input.brief,model,policy:GENERATION_POLICY,sdkSha256,...(input.scope==='paper'?{scope:input.scope,anchor:input.anchor}:{}),...(frozen&&!frozen.retrieval?{}:{retrieval:retrieval?.selectionSha256,promptContractSha256})});
    return {source,selected,anchor:input.anchor,documentHash,contextHash,retrieval,selection,query,promptContractSha256,sdkSha256};
  }

  function ref(run: GenerationRunRecord, key: string): GenerationRunRef {
    return { runId: run.runId, model: run.model, createdAt: run.createdAt, deadlineAt: run.deadlineAt, token: signToken({ kind: 'artifact-generation-run', owner: run.owner, runId: run.runId, contextHash: run.contextHash, model: run.model, createdAt: run.createdAt, deadlineAt: run.deadlineAt, exp: run.createdAt + 86_400_000 }, key) };
  }
  function authorize(input: GenerationRunRef, owner: string, key: string) {
    const token = verifyToken(input.token, key);
    if (token.kind !== 'artifact-generation-run' || token.owner !== owner || token.runId !== input.runId || token.model !== input.model || token.createdAt !== input.createdAt || token.deadlineAt !== input.deadlineAt || typeof token.exp !== 'number' || now() >= token.exp) throw new AnalysisHttpError(403, 'This generation capability is expired or belongs to another browser.');
    const run = store().generationRun(input.runId, owner);
    if (token.contextHash !== run.contextHash || run.model !== input.model || run.createdAt !== input.createdAt || run.deadlineAt !== input.deadlineAt) throw new AnalysisHttpError(403, 'Generation capability differs from its durable run.');
    return run;
  }
  async function checkedContext(input: Context, run: GenerationRunRecord) {
    const checked = await context(input,run.model,run);
    if (checked.contextHash !== run.contextHash || checked.documentHash !== run.documentHash || input.sectionId !== run.sectionId) throw new AnalysisHttpError(409, 'Source, section and brief are frozen for this generation run.');
    return checked;
  }
  function reply(run: GenerationRunRecord, key: string, value: Omit<GenerationReply, 'run' | 'budget' | 'paperBudget'>): GenerationReply {
    const current = store().generationRun(run.runId, run.owner);
    const attempt=value.attempt??current.attempts.length,record=attempt?store().generationAttempt(current.runId,current.owner,attempt):undefined;
    const metrics=record?.requestMetrics??current.previewMetrics;const accounting:ModelRequestAccounting|undefined=metrics?{request:metrics,actualUsage:record?.actualUsage??null,estimatePurpose:'conservative-quota-reservation-not-financial-quote',localTests:'provider-free'}:undefined;
    return { ...value,retrieval:current.retrieval,...(accounting?{accounting}:{}), run: ref(current, key), budget: { maxAttempts: current.maxAttempts, attemptsClaimed: current.attempts.length, maxReservedTokens: 666000, reservedTokens: current.reservedTokens, maxOutputTokensPerAttempt: 6000, maxInputCharactersPerAttempt: generationInputCharacterLimit(current.sectionId===WHOLE_PAPER_SECTION_ID?'paper':undefined) }, paperBudget: store().budget(current.owner, current.documentHash) };
  }
  function candidate(response: ProviderResponse, checked: Awaited<ReturnType<typeof context>>, run: GenerationRunRecord, attempt: number): GenerationCandidate {
    if (!response.output_text || Buffer.byteLength(response.output_text) > 96*1024) throw Error('Output exceeds limit.');
    const output = generationModelOutputSchema.parse(JSON.parse(response.output_text));
    if(checked.retrieval)validateGeneratedMethodSelection(output.sourceCode,checked.retrieval);
    const norm = (text: string) => text.replace(/\s+/g, ' ').trim();
    if(checked.anchor&&(output.anchor.blockId!==checked.anchor.blockId||output.anchor.page!==checked.anchor.page||output.anchor.quote!==checked.anchor.quote))throw Error('The generated interaction moved away from the approved figure anchor.');
    if (!checked.selected.section.segments.some(segment => segment.blockId === output.anchor.blockId && segment.page === output.anchor.page && norm(segment.text).includes(norm(output.anchor.quote))) || norm(output.anchor.quote).length < 12) throw Error('Anchor outside selected coverage.');
    const fields = (items: typeof output.inputFields) => items.map(({ maxItems, ...field }) => ({ ...field, ...(maxItems === null ? {} : { maxItems }) }));
    const artifact = validateFigureArtifact({ format: 'paperplay-figure-artifact', schemaVersion: 1, id: `generated-${run.runId.slice(0,8)}-${attempt}`, title: output.title, kind: 'generated', source: { documentId: checked.source.id, sourceVersion: checked.source.sourceVersion }, authorship: { kind: 'meta', label: 'Meta-proposed unverified teaching interaction' }, anchors: [{ id: 'passage', ...output.anchor }], assumptions: output.plan.assumptions, rights: 'Model-authored teaching code. Source paper/data rights remain separate; no third-party assets are bundled.', sdk: { id: 'paperplay-figure-sdk', version: '1.0.0' }, entry: { file: 'figure.js', export: 'update', language: 'javascript', source: output.sourceCode, sha256: textHash(output.sourceCode) }, dependencyLock: [{ id: 'paperplay-figure-sdk', version: '1.0.0', sha256:run.sdkSha256??textHash(FIGURE_SDK_SOURCE), license: 'ISC' }], capabilityRequests: ['draw-2d','controls','source-return','entity-selection'], interfaces: { input: fields(output.inputFields), state: fields(output.stateFields), output: 'paperplay-sdk-frame-v1' }, initialInput: JSON.parse(output.initialInputJson), assetIds: [], assetBindings: [], resources: { maxSourceBytes: 16384, maxInputBytes: 16384, maxStateBytes: 16384, maxOutputBytes: 65536, maxMarks: 256, maxControls: 8, maxExecutionMs: 100, maxMemoryBytes: 8*1024*1024, maxStackBytes: 256*1024 }, tests: output.checks.map((description,index) => ({ id: `declared-${index}`, kind: 'invariant', description, expected: 'Not executed. Model-declared expectation; scientific evidence remains unverified.' })), provenance: { origin: 'model-authored', evidence: 'unverified', references: [] } }, checked.source);
    const value = { plan: output.plan, artifact }; return { ...value, sha256: hash(value) };
  }
  async function settle(record: EnrichmentRecord, response: ProviderResponse, status: Exclude<EnrichmentRecord['status'], 'reserved'>) {
    const terminal = !['reserved','accepted','uncertain'].includes(record.status);
    const finalStatus = terminal ? record.status as Exclude<EnrichmentRecord['status'], 'reserved'> : status;
    const acceptMeasurement = !terminal || (record.actualTokens === undefined ? status === record.status : (response.usage?.total_tokens ?? -1) >= record.actualTokens);
    const measured = response.usage && acceptMeasurement ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } : undefined;
    try { store().settle(record.id, { status: finalStatus, providerId: response.id, ...(measured ? { actualTokens: measured.totalTokens,actualUsage:measured } : {}) }); } catch { /* conservative reservation remains */ }
    try { await usage().settle(record.id, { status: finalStatus, providerId: response.id, ...(measured ? { usage: measured } : {}) }); } catch { /* conservative reservation remains */ }
  }
  async function map(response: ProviderResponse, checked: Awaited<ReturnType<typeof context>>, run: GenerationRunRecord, attempt: number, record: EnrichmentRecord, key: string) {
    if (response.id !== record.providerId) throw new AnalysisHttpError(502, 'Provider response differs from the accepted job.');
    if (!['reserved','accepted','uncertain'].includes(record.status) && !['completed','failed','cancelled','incomplete'].includes(response.status ?? '')) return reply(run, key, { status: 'uncertain', attempt, uncertain: true, error: 'The provider returned an older job state. The durable terminal record and previous candidate are retained; no replacement was created.' });
    let value: Omit<GenerationReply, 'run' | 'budget' | 'paperBudget'>;
    let status: Exclude<EnrichmentRecord['status'], 'reserved'>;
    if (response.status === 'completed') {
      try { const proposed = candidate(response, checked, run, attempt); store().recordGenerationCandidate(run.runId, run.owner, attempt, proposed.sha256); value = { status: 'complete', attempt, candidate: proposed }; status = 'completed'; }
      catch { value = { status: 'failed', attempt, error: 'The completed response failed artifact/source validation. No code was executed or accepted.' }; status = 'validation_failed'; }
    } else if (response.status === 'failed' || response.status === 'cancelled' || response.status === 'incomplete') { value = { status: response.status, attempt, error: `Generation ${response.status}. Previous work is retained.` }; status = response.status; }
    else { value = { status: response.status === 'queued' ? 'queued' : 'analyzing', attempt }; status = 'accepted'; }
    await settle(record, response, status); return reply(run, key, value);
  }
  async function retrieve(run: GenerationRunRecord, attempt: number, checked: Awaited<ReturnType<typeof context>>, config: MetaConfig, key: string, cancel = false) {
    const record = store().generationAttempt(run.runId, run.owner, attempt);
    if(!cancel){
      const completed=finished.get(record.id);if(completed){if(completed.error)throw completed.error;return completed.value!;}
      if(running.has(record.id))return reply(run,key,{status:'analyzing',attempt});
    }
    if (!record.providerId) return reply(run, key, { status: record.status === 'rejected' ? 'failed' : 'uncertain', attempt, error: 'No recoverable provider reference is available. No replacement request was sent.', uncertain: record.status !== 'rejected' });
    let response: ProviderResponse;
    try { const adapter = provider({ ...config, model: run.model }); response = cancel ? await adapter.cancel(record.providerId) : await adapter.retrieve(record.providerId); if (cancel && response.status === 'completed') response = await adapter.retrieve(record.providerId); }
    catch (error) { const safe = safeProviderError(error, false); if (safe.status === 410) return reply(run, key, { status: 'expired', attempt, error: safe.message }); throw safe; }
    return map(response, checked, run, attempt, record, key);
  }
  return {
    async prepare(request: Request) {
      try { const { config, key, session } = configFor(request, true); const input = generationPrepareSchema.parse(await readJson(request)); let existing:GenerationRunRecord|undefined;try{existing=store().generationRun(input.runId,session.sid);}catch(error){if(!(error instanceof AnalysisHttpError)||error.status!==404)throw error;}const checked=await context(input,config.model,existing);
        const previewMetrics=checked.selection?generationPromptMetrics({context:checked.selected.text,brief:input.brief,attempt:1,retrieval:checked.selection,...(input.scope==='paper'?{scope:input.scope,anchor:input.anchor}:{})},config.model):existing?.previewMetrics;if(previewMetrics&&previewMetrics.characters>generationInputCharacterLimit(input.scope))throw new AnalysisHttpError(400,'The complete generation prompt exceeds its transport limit. No source text was removed.');
        const run = store().prepareGenerationRun({ runId: input.runId, owner: session.sid, documentHash: checked.documentHash, contextHash: checked.contextHash, sectionId: input.sectionId, model: config.model, maxAttempts: input.maxAttempts,retrieval:existing?existing.retrieval:checked.retrieval,previewMetrics,promptContractSha256:existing?.promptContractSha256??checked.promptContractSha256,sdkSha256:existing?.sdkSha256??checked.sdkSha256 });
        return json(reply(run, key, { status: run.closed ? 'cancelled' : now() >= run.deadlineAt ? 'expired' : 'prepared' }), 200, session.cookie);
      } catch (error) { return fail(error); }
    },
    async start(request: Request) {
      try { const { config, key, session } = configFor(request); const input = generationStartSchema.parse(await readJson(request)); const run = authorize(input.run, session.sid, key); const checked = await checkedContext(input, run);
        if (input.attempt > run.maxAttempts) return json(reply(run, key, { status: 'exhausted', error: 'The authorized attempt budget is exhausted.' }));
        if (!run.attempts[input.attempt - 1] && (run.closed || now() >= run.deadlineAt)) return json(reply(run, key, { status: run.closed ? 'cancelled' : 'expired', error: 'No new paid work can start in this closed or expired run.' }));
        if (input.attempt === 1 && (input.previous || input.feedback)) throw new AnalysisHttpError(400, 'Initial creation does not accept repair feedback.');
        if (input.attempt > 1) {
          const previous = run.attempts[input.attempt - 2]; if (!previous) throw new AnalysisHttpError(409, 'Resolve the previous attempt first.');
          if (previous.candidateSha256) {
            if (!input.previous || input.previous.sha256 !== previous.candidateSha256 || hash({ plan: input.previous.plan, artifact: input.previous.artifact }) !== previous.candidateSha256 || input.feedback?.candidateSha256 !== previous.candidateSha256) throw new AnalysisHttpError(409, 'Repair feedback must match the exact preceding candidate.');
            validateFigureArtifact(input.previous.artifact, checked.source);
            if (!input.feedback) throw new AnalysisHttpError(400, 'Local diagnostics are required for this repair.');
            const feedback = input.feedback;
            if (['cancelled','unavailable'].includes(feedback.compiler.status) || feedback.compiler.diagnostics.some(item => ['integrity','resource','cancelled','unavailable'].includes(item.code)) || feedback.runtime.status === 'cancelled' || feedback.runtime.code && ['integrity','resource','unavailable'].includes(feedback.runtime.code)) throw new AnalysisHttpError(400, 'Infrastructure, cancellation and resource failures do not authorize paid repair.');
            if (feedback.quality && (['cancelled','unavailable'].includes(feedback.quality.status) || feedback.quality.diagnostics.some(item => item.scope === 'host'))) throw new AnalysisHttpError(400, 'Host layout, infrastructure and cancellation diagnostics do not authorize paid repair.');
            const qualityActionable = feedback.quality?.status === 'failed' && feedback.quality.diagnostics.some(item => item.scope === 'artifact' && ['blank-scene','text-clipped','text-overlap','legend-overlap','unreachable-control','invalid-input','invalid-output','execution'].includes(item.code));
            const actionable = qualityActionable || feedback.compiler.diagnostics.some(item => ['syntax','entry','dependency','unsupported-syntax','complexity'].includes(item.code)) || feedback.runtime.status === 'failed' && feedback.runtime.code && ['invalid-input','invalid-output','execution'].includes(feedback.runtime.code);
            if (!actionable) throw new AnalysisHttpError(400, 'No actionable local failure was supplied for repair.');
          } else if (input.previous || input.feedback?.candidateSha256) throw new AnalysisHttpError(409, 'The preceding attempt produced no admitted candidate.');
        }
        const id=usageIdFor(session.sid,`artifact-${run.runId}-${input.attempt}`);
        const fingerprint=hash({frozen:run.contextHash,context:checked.selected.text,brief:input.brief,attempt:input.attempt,previous:input.previous??null,feedback:input.feedback??null,retrieval:run.retrieval?.receiptSha256??null,model:run.model});
        const acceptedAttempt=run.attempts[input.attempt-1],priorAttempt=acceptedAttempt?store().generationAttempt(run.runId,session.sid,input.attempt):undefined;if(acceptedAttempt&&!(priorAttempt?.status==='rejected'&&priorAttempt.actualTokens===0&&!priorAttempt.providerId)){if(run.retrieval&&acceptedAttempt.fingerprint!==fingerprint)throw new AnalysisHttpError(409,'This attempt already belongs to different frozen input.');const pending=running.get(id);if(pending)return json(provider(config).executionMode==='host'?reply(run,key,{status:'analyzing',attempt:input.attempt}):await pending);return json(await retrieve(run,input.attempt,checked,config,key));}
        if (!config.inferenceEnabled) throw new AnalysisHttpError(503, config.disabledReason ?? 'New Meta requests are disabled.');
        if(!readAdoptionPolicy(process.env).generatedExecution)throw new AnalysisHttpError(503,'New generated artifacts are disabled by the operator. Accepted jobs and recorded replay remain available.');
        if(!run.retrieval)throw new AnalysisHttpError(409,'This run predates frozen capability retrieval. Retrieve accepted work; explicitly prepare a new run for new creation.');
        if(run.promptContractSha256!==hash({instructions:generationInstructions(input),schema:generationProviderRequest({context:checked.selected.text,brief:input.brief,attempt:1,...(input.scope==='paper'?{scope:input.scope,anchor:input.anchor}:{})}).text.format.schema})||run.sdkSha256!==textHash(FIGURE_SDK_SOURCE))throw new AnalysisHttpError(409,'The frozen prompt/SDK contract changed. Retrieve accepted work or explicitly prepare a new run.');
        const selection=await retrieveCapabilities(checked.query);if(selection.selectionSha256!==run.retrieval.selectionSha256)throw new AnalysisHttpError(409,'The frozen catalog changed. Retrieve existing attempts or explicitly prepare a new run; no repair was submitted.');
        if(selection.gaps.some(g=>g.blocking))throw new AnalysisHttpError(409,'A required exact capability is unavailable. Retain the source-linked fallback.');
        const providerInput:GenerationProviderInput={context:checked.selected.text,brief:input.brief,attempt:input.attempt,retrieval:selection,...(input.scope==='paper'?{scope:input.scope,anchor:input.anchor}:{}),...(input.previous?{previous:input.previous}:{}),...(input.feedback?{feedback:input.feedback}:{})};
        const metrics=generationPromptMetrics(providerInput,run.model),characters=metrics.characters;if(characters>generationInputCharacterLimit(input.scope))throw new AnalysisHttpError(400,'The complete generation prompt (paper/instructions/schema/feedback) exceeds its transport limit. No source text was removed.');
        const reservation = { id, sessionId: session.sid, kind: 'analysis' as const, maxOutputTokens: 6000, inputCharacters: characters, model: run.model, fingerprint };
        const claimed = store().claimGenerationAttempt(run.runId, session.sid, input.attempt, { id, owner: session.sid, documentHash: run.documentHash, contextHash: fingerprint, action: 'artifact', sectionId: run.sectionId, reservedTokens: reservedTokensFor(reservation),retrieval:run.retrieval,requestMetrics:metrics,requestSha256:textHash(JSON.stringify(generationProviderRequest(providerInput,run.model))) });
        if (!claimed.created) { const pending = running.get(id); if (pending) return json(provider(config).executionMode==='host'?reply(run,key,{status:'analyzing',attempt:input.attempt}):await pending); return json(await retrieve(run, input.attempt, checked, config, key)); }
        try { const global = await usage().reserve(reservation); if (!global.created) { store().settle(id, { status: 'uncertain' }); throw new AnalysisHttpError(409, 'The shared request identifier is already unresolved.', true); } }
        catch (error) { if (!(error instanceof AnalysisHttpError && error.uncertain)) store().settle(id, { status: 'rejected', actualTokens: 0 }); throw error; }
        const work = (async () => {
          let response: ProviderResponse;
          try { const latestConfig=dependencies.getConfig();if(!readAdoptionPolicy(process.env).generatedExecution)throw new AnalysisHttpError(503,'New generated artifacts are disabled by the operator.');if(!latestConfig.inferenceEnabled)throw new AnalysisHttpError(503,latestConfig.disabledReason??'New Meta requests are disabled.');const current = store().generationRun(run.runId, run.owner); if (current.closed || now() >= current.deadlineAt) throw new AnalysisHttpError(410, 'This run closed or expired before provider submission.'); response = await provider({ ...config, model: run.model }).start(providerInput); }
          catch (error) { const safe = safeProviderError(error, true); try { store().settle(id, { status: safe.uncertain ? 'uncertain' : 'rejected', ...(safe.uncertain ? {} : { actualTokens: 0 }) }); } catch {} try { await usage().settle(id, { status: safe.uncertain ? 'uncertain' : 'rejected' }); } catch {} throw safe; }
          if (!providerId.test(response.id)) { try { store().settle(id, { status: 'uncertain' }); } catch {} throw new AnalysisHttpError(504, 'Meta may have accepted this attempt without a recoverable reference. No replacement was sent.', true); }
          // Persist the accepted reference before validation or optional usage reporting.
          store().settle(id, { status: 'accepted', providerId: response.id });
          return map(response, checked, run, input.attempt, { ...claimed.record, providerId: response.id }, key);
        })(); running.set(id, work);
        if(provider(config).executionMode==='host'){
          void work.then(value=>{if(value.status!=='queued'&&value.status!=='analyzing')remember(id,{value});},error=>remember(id,{error})).finally(()=>running.delete(id));
          return json(reply(run,key,{status:'queued',attempt:input.attempt}));
        }
        try { return json(await work); } finally { running.delete(id); }
      } catch (error) { return fail(error); }
    },
    async status(request: Request) {
      try { const { config, key, session } = configFor(request); const input = generationStatusSchema.parse(await readJson(request)); const run = authorize(input.run, session.sid, key); const checked = await checkedContext(input, run); return json(await retrieve(run, input.attempt, checked, config, key)); } catch (error) { return fail(error); }
    },
    async cancel(request: Request) {
      try { const { config, key, session } = configFor(request); const input = generationCancelSchema.parse(await readJson(request)); const run = authorize(input.run, session.sid, key); store().closeGenerationRun(run.runId, run.owner);
        const attempt = run.attempts.length;
        if (attempt) { const record = store().generationAttempt(run.runId, run.owner, attempt); if (record.providerId && ['reserved','accepted','uncertain'].includes(record.status)) { try { const response = await provider({ ...config, model: run.model }).cancel(record.providerId); if (response.id !== record.providerId) throw new AnalysisHttpError(502, 'Provider cancellation reference differs.'); if (response.status === 'cancelled') await settle(record, response, 'cancelled'); } catch (error) { throw safeProviderError(error, false); } } }
        return json(reply(run, key, { status: 'cancelled', ...(attempt ? { attempt } : {}), error: 'The run is closed to new attempts. Accepted work can still be retrieved; cancellation is best effort.' }));
      } catch (error) { return fail(error); }
    },
  };
}
