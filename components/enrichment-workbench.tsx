'use client';

import './widgets/widgets.css';
import {useAdoptionPolicy,requireAdoptionPermission} from './adoption-policy-provider';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { SourceDocument } from '@/shared/schema';
import { validateWidgetEnvelope, type WidgetEnvelope } from '@/shared/widgets';
import { Button } from './ui/button';
import { modelRequestAccountingSchema } from '@/shared/capability-retrieval';
import { enrichmentRetrievalQuery } from '@/lib/retrieval/selection';
import { useCapabilityReview,InferenceContextReview,InferenceStageAccounting } from './inference-budget';
import budgetStyles from './inference-budget.module.css';
import { WIDGET_CATALOG_VERSION, getWidgetDescriptor } from '@/lib/widgets/catalog';
import { buildSourceSections } from '@/lib/enrichment/sections';
import { enrichmentResultSchema, type EnrichmentAction, type EnrichmentProposal, type EnrichmentReply } from '@/lib/enrichment/contracts';
import { acceptEnrichmentWidget, emptyEnrichmentState, enrichmentFingerprint, enrichmentSourceIdentity, enrichmentStorageKey, parseEnrichmentState, serializeEnrichmentState, undoEnrichmentWidget, type EnrichmentState, type PendingEnrichment } from '@/lib/enrichment/state';

const WidgetView = lazy(() => import('./widgets/widget-view').then(m => ({ default: m.WidgetView })));
type Props = { source: SourceDocument; widgets?: WidgetEnvelope[]; onAcceptWidget?: (envelope: WidgetEnvelope) => boolean | void; onRemoveWidget?: (id: string) => void; renderAccepted?: boolean; onStateChange?:(state:EnrichmentState)=>void; requestedSectionId?:string };
const fieldStyle = { display: 'grid', gap: 6, minWidth: 0 } as const;
const inputStyle = { fontSize: '1rem', padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--paper)', color: 'var(--ink)', width: '100%', minWidth: 0 } as const;

export function EnrichmentWorkbench(props: Props) {
  const identity = useMemo(() => enrichmentSourceIdentity(props.source), [props.source]);
  const key = useMemo(() => { let a=2166136261,b=5381; for(let i=0;i<identity.length;i++){a=Math.imul(a^identity.charCodeAt(i),16777619);b=Math.imul(b,33)^identity.charCodeAt(i);}return `${props.source.id}:${props.source.sourceVersion}:${a>>>0}:${b>>>0}`; }, [identity,props.source.id,props.source.sourceVersion]);
  return <EnrichmentSession key={key} {...props}/>;
}
function EnrichmentSession({ source, widgets = [], onAcceptWidget, onRemoveWidget, renderAccepted = true,onStateChange,requestedSectionId }: Props) {
  const policy=useAdoptionPolicy();
  const sections = useMemo(() => buildSourceSections(source), [source]);
  const [data, setData] = useState<EnrichmentState>(); const current = useRef<EnrichmentState | undefined>(undefined); const storageKey = useRef(''); const mounted = useRef(true);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? ''); const [busy, setBusy] = useState(false); const [paused, setPaused] = useState(false);
  useEffect(()=>{if(requestedSectionId&&sections.some(section=>section.id===requestedSectionId))setSectionId(requestedSectionId);},[requestedSectionId,sections]);
  const [storageWarning,setStorageWarning]=useState('');
  const [message, setMessage] = useState(''); const [storageBlocked, setStorageBlocked] = useState(false); const [targetId, setTargetId] = useState(''); const [feedback, setFeedback] = useState('');
  const [creativeBrief,setCreativeBrief]=useState('');
  const [lastReply,setLastReply]=useState<EnrichmentReply|null>(null),[operation,setOperation]=useState<'start'|'status'|'cancel'|null>(null);
  const [previewId, setPreviewId] = useState(''); const [showRemoved, setShowRemoved] = useState(false);
  useEffect(()=>{if(data)onStateChange?.(data);},[data,onStateChange]);
  useEffect(() => {
    mounted.current = true;
    void enrichmentFingerprint(source).then(fingerprint => {
      if (!mounted.current) return; storageKey.current = enrichmentStorageKey(source, fingerprint);
      let next = emptyEnrichmentState(fingerprint);
      try { const raw = localStorage.getItem(storageKey.current); if (raw) next = parseEnrichmentState(raw, source, fingerprint); }
      catch { setStorageBlocked(true); setMessage('The previous enrichment cache cannot be opened safely. It was retained unchanged. You can keep reading and export your existing work; explicitly forget the incompatible cache to start a new one.'); }
      current.current = next; setData(next);
    }).catch(() => { if (mounted.current) setMessage('The source fingerprint is unavailable. New enrichment is disabled; reading remains available.'); });
    return () => { mounted.current = false; };
  }, [source.id, source.sourceVersion]);
  function commit(next: EnrichmentState) {
    current.current = next;
    if (mounted.current) setData(next);
    if (storageBlocked || !storageKey.current) return false;
    try { localStorage.setItem(storageKey.current, serializeEnrichmentState(next)); if(mounted.current)setStorageWarning(''); return true; }
    catch { if (mounted.current) setStorageWarning('This enrichment is available now, but browser storage could not save it. Export accepted widgets before closing.'); return false; }
  }
  function patch(update: (state: EnrichmentState) => EnrichmentState) { if (current.current) commit(update(current.current)); }
  const allWidgets = useMemo(() => [...new Map([...(data?.accepted ?? []), ...widgets.filter(w => w.source.documentId === source.id && w.source.sourceVersion === source.sourceVersion)].map(w => [w.id, w])).values()], [data?.accepted, widgets, source.id, source.sourceVersion]);
  const target = allWidgets.find(w => w.id === targetId);
  const section = sections.find(s => s.id === sectionId);
  const targetSection=sections.find(s=>s.segments.some(segment=>segment.blockId===target?.source.blockId&&segment.text.replace(/\s+/g,' ').includes(target?.source.quote.replace(/\s+/g,' ')??'\u0000')));
  const planKey=JSON.stringify({fingerprint:data?.fingerprint,sectionId,brief:creativeBrief.trim()});
  const planReview=useCapabilityReview(planKey,()=>enrichmentRetrievalQuery({source,sectionId,action:'plan',feedback:creativeBrief.trim()}),!!data&&!!section);
  const targetKey=JSON.stringify({fingerprint:data?.fingerprint,sectionId:targetSection?.id,targetId:target?.id,kind:target?.spec.kind,source:target?.source,feedback:feedback.trim()});
  const repairReview=useCapabilityReview(`${targetKey}/repair`,()=>enrichmentRetrievalQuery({source,sectionId:targetSection!.id,action:'repair',feedback:feedback.trim(),target}),!!data&&!!target&&!!targetSection);
  const editReview=useCapabilityReview(`${targetKey}/edit`,()=>enrichmentRetrievalQuery({source,sectionId:targetSection!.id,action:'edit',feedback:feedback.trim(),target}),!!data&&!!target&&!!targetSection);
  function handleReply(reply: EnrichmentReply, pending: PendingEnrichment) {
    if (!current.current) return;
    let next = { ...current.current, ...(reply.budget ? { budget: reply.budget } : {}) };
    if (reply.job && ['queued','analyzing'].includes(reply.status)) next.pending = { ...pending, job: reply.job, uncertain: false };
    else {
      delete next.pending;
      if (reply.status === 'complete' && reply.result) {
        const result = enrichmentResultSchema.parse(reply.result);
        for (const p of result.proposals) validateWidgetEnvelope(p.envelope, source);
        next.plans = [...next.plans, result].slice(-32);
        if (pending.action === 'plan') next.coverage = { ...next.coverage, [pending.sectionId]: result.proposals.length ? 'analysed' : 'unsupported' };
        if (mounted.current) setMessage(result.proposals.length ? 'Grounded proposals are ready for inspection. Nothing is applied until you accept it.' : 'No valid supported widget was proposed. The source and previous valid figures are retained.');
      } else {
        if (pending.action === 'plan' && !next.coverage[pending.sectionId]) next.coverage = { ...next.coverage, [pending.sectionId]: 'failed' };
        if (mounted.current) setMessage(reply.error ?? `Enrichment ${reply.status}. The source and previous valid widgets remain available.`);
      }
    }
    commit(next);
  }
  async function send(path: 'start' | 'status' | 'cancel', pending: PendingEnrichment) {
    if (!current.current || busy || storageBlocked) return;
    setBusy(true); setOperation(path); setPaused(false); setMessage('');
    try {
      const payload = { source, sectionId: pending.sectionId, action: pending.action, feedback: pending.feedback,...(pending.retrievalSelectionSha256?{retrievalSelectionSha256:pending.retrievalSelectionSha256}:{}),
        ...(pending.target ? { target: pending.target } : {}), ...(path === 'start' ? { requestId: pending.requestId } : { job: pending.job }) };
      const response = await fetch(`/api/enrichment/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const reply = await response.json().catch(() => { throw Error('The enrichment endpoint returned an unreadable response. The saved request is retained.'); }) as EnrichmentReply;
      if(reply.accounting)reply.accounting=modelRequestAccountingSchema.parse(reply.accounting);setLastReply(reply);
      if (!response.ok) {
        if (path === 'start' && !reply.uncertain && response.status !== 409) { const next = { ...current.current }; delete next.pending; if (pending.action === 'plan' && !next.coverage[pending.sectionId]) next.coverage = { ...next.coverage, [pending.sectionId]: 'failed' }; commit(next); }
        else patch(s => ({ ...s, pending: { ...pending, uncertain: true } }));
        throw Error(reply.error ?? `Enrichment request unavailable (${response.status}).`);
      }
      handleReply(reply, pending);
    } catch (error) { if (mounted.current) { setPaused(true); setMessage(error instanceof Error ? error.message : 'A connection failed. The saved request is retained; no automatic replacement is sent.'); } }
    finally { if (mounted.current){setBusy(false);setOperation(null);} }
  }
  useEffect(() => {
    if (!data?.pending?.job || busy || paused || storageBlocked) return;
    const pending = data.pending; const timer = setTimeout(() => { void send('status', pending); }, 2000);
    return () => clearTimeout(timer);
  }, [data?.pending, busy, paused, storageBlocked]);
  async function start(action: EnrichmentAction) {
    if (!current.current || busy || current.current.pending || storageBlocked) return;
    const review=action==='plan'?planReview:action==='repair'?repairReview:editReview;if(!review.ready||!review.selection){setMessage('Wait for the current local context review to finish. No model request was made.');return;}
    const chosen = action === 'plan' ? sections.find(s => s.id === sectionId) : sections.find(s => s.segments.some(segment => segment.blockId === target?.source.blockId && segment.text.replace(/\s+/g,' ').includes(target?.source.quote.replace(/\s+/g,' ') ?? '\u0000')));
    if (!chosen || action !== 'plan' && !target) { setMessage('Choose a valid widget and a source section containing its exact quote.'); return; }
    if (action !== 'plan' && feedback.trim().length < 4) { setMessage('Describe the requested repair or settings change.'); return; }
    setBusy(true);
    try {
      await requireAdoptionPermission('newModelCreation');
      // No inference in this roundtrip. It makes anonymous ownership durable
      // before a creation can have an ambiguous network outcome.
      const response = await fetch('/api/enrichment/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) { const b = await response.json(); throw Error(b.error ?? 'Meta enrichment is unavailable.'); }
      const pending: PendingEnrichment = { requestId: crypto.randomUUID(), sectionId: chosen.id, action, retrievalSelectionSha256:review.selection.selectionSha256, feedback: action === 'plan' ? creativeBrief.trim() : feedback.trim(), ...(target && action !== 'plan' ? { target: structuredClone(target) } : {}) };
      if(!commit({ ...current.current, pending })){const next={...current.current!};delete next.pending;commit(next);throw Error('Browser storage could not save the request reference. No model creation was attempted.');} setBusy(false); void send('start', pending);
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : 'Could not establish the enrichment session. No creation was attempted.'); }
  }
  function accept(proposal: EnrichmentProposal) {
    try {
      const envelope = validateWidgetEnvelope(proposal.envelope, source); let state = current.current!;
      const previous = allWidgets.find(w => w.id === envelope.id);
      if (previous && !state.accepted.some(w => w.id === previous.id)) state = { ...state, accepted: [...state.accepted, previous] };
      state = acceptEnrichmentWidget(state, envelope);
      if(onAcceptWidget?.(envelope)===false)throw Error('The source workspace could not accept this proposal. Existing figures were retained.');
      commit({ ...state, decisions: { ...state.decisions, [envelope.id]: 'accepted' } }); setTargetId(envelope.id); setPreviewId(envelope.id); setMessage('Accepted locally. No additional model call was made.');
    } catch(error) { setMessage(error instanceof Error?error.message:'This proposal cannot be applied to the current source. Previous valid work was retained.'); }
  }
  function undo(id: string) { if (!current.current) return; const previous = undoEnrichmentWidget(current.current, id); commit(previous.state); if (previous.envelope) onAcceptWidget?.(previous.envelope); setMessage(previous.envelope ? 'Restored the previous valid local revision without inference.' : 'No earlier local revision is available.'); }
  const pending = data?.pending; const latest = data?.plans.at(-1);
  return <section className={`enrichment-workbench ${budgetStyles.workbench}`} aria-label="Source-linked Meta enrichment" style={{ minWidth: 0, display: 'grid', gap: 16, fontSize: '1rem' }}>
    <header><h3 style={{ margin: '0 0 8px' }}>Add figures with Meta</h3><p style={{ margin: 0 }}>Choose a section. Meta will suggest interactive figures for you to preview and add to the paper.</p></header>
    <details className="muse-capabilities" aria-label="Muse widget capabilities"><summary>What can Muse create?</summary><p>Interactive equations and curves, concept diagrams, sortable tables, matrix/vector views, probability experiments, attention heatmaps, pathfinding and convolution.</p><p>For a mechanism that needs a new form, Muse can design a custom animated model: adjustable parameters, evolving state, arrows, shapes, labels, changing visibility, metrics and a recorded curve.</p><p>Each figure cites a passage. Custom models illustrate a bounded mechanism; they do not run arbitrary code, train a model or reproduce the paper’s experiments.</p></details>
    {!policy.newModelAllowed&&<p role="status">{policy.modelMessage}</p>}
    <label className="muse-brief">What would you like to explore? (optional)<textarea maxLength={1200} value={creativeBrief} disabled={busy||!!pending} onChange={event=>setCreativeBrief(event.target.value)} placeholder="For example: show how two components interact, with clear labels and a parameter I can change."/></label>
    <div className="muse-brief-examples" role="group" aria-label="Ideas for Muse">{['Show the mechanism step by step','Let me compare the effect of two parameters','Explain the geometry with an animated model'].map(idea=><Button key={idea} variant="outline" disabled={busy||!!pending} onClick={()=>setCreativeBrief(idea)}>{idea}</Button>)}</div>
    <details><summary>Coverage and inference budget</summary><p>When you explicitly ask, the application server receives the normalized source for validation. Meta receives the selected passages, limited neighboring context and, for a repair/edit, the selected widget configuration and your feedback. Original PDF bytes are not included in these requests.</p><p>The complete source stays in the reader. Each explicit request analyzes only the selected bounded section and limited neighboring context. Catalog {WIDGET_CATALOG_VERSION}.</p><p>{data?.budget ? `${data.budget.requests} / ${data.budget.maxRequests} per-paper requests; ${data.budget.accountedTokens.toLocaleString()} / ${data.budget.maxTokens.toLocaleString()} conservatively accounted tokens.` : 'Default per-paper ceiling: 8 requests and 1,000,000 conservatively accounted tokens; shared application quotas also apply. This is not a dollar cap or credit balance.'}</p><ul>{sections.map(s => <li key={s.id}>{s.title} · {s.characters.toLocaleString()} source characters · {data?.coverage[s.id] ?? 'unanalyzed'}{s.partial ? ' · disclosed partial-block segment' : ''}</li>)}</ul></details>
    <label style={fieldStyle}>Source section<select style={inputStyle} value={sectionId} disabled={busy||!!pending} onChange={e => setSectionId(e.target.value)}>{sections.map(s => <option value={s.id} key={s.id}>{s.title} · {data?.coverage[s.id] ?? 'unanalyzed'}{s.partial ? ' · partial block segment' : ''}</option>)}</select></label>
    {section && <p style={{ margin: 0 }}>Selected scope: {section.characters.toLocaleString()} characters in {section.segments.length} source fragment(s). This is section enrichment, not complete-paper analysis.</p>}
    <InferenceContextReview selection={planReview.selection} context={planReview.context} error={planReview.error} maxCalls={1} maxOutputTokens={6000} reservedTokenCeiling={302000}/>
    <Button style={{ justifySelf: 'start', minHeight: 44 }} disabled={!policy.newModelAllowed||!data || busy || !!pending || storageBlocked||!planReview.ready} onClick={() => void start('plan')}>Generate figure suggestions</Button>
    <p className="reader-hint">Generating suggestions uses Meta credits and sends the selected source passages. Opening these tools makes no model request.</p>
    {pending && <aside role="status"><strong>{pending.job ? `Accepted ${pending.action} job · ${pending.sectionId}` : 'Saved submission reference · awaiting acceptance confirmation'}</strong><p>Waiting/reopening retrieves this same job. No replacement paid analysis is automatically submitted.</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{pending.job ? <><Button variant="outline" disabled={busy} onClick={() => void send('status', pending)}>Resume saved job</Button><Button variant="outline" disabled={busy} onClick={() => void send('cancel', pending)}>Cancel accepted job</Button></> : <Button variant="outline" disabled={busy} onClick={() => void send('start', pending)}>Reconcile the same request ID</Button>}</div></aside>}
    {storageBlocked && <Button variant="outline" onClick={() => { try { localStorage.removeItem(storageKey.current); setStorageBlocked(false); setMessage('The incompatible local enrichment cache was explicitly removed. The paper source was not changed.'); } catch { setMessage('Browser storage is unavailable.'); } }}>Forget incompatible enrichment cache</Button>}
    {message && <p role="status" style={{ overflowWrap: 'anywhere', margin: 0 }}>{message}</p>}
    {storageWarning&&<p role="status">{storageWarning}</p>}
    {busy && <p role="status">{operation==='status'?'Retrieving the existing job; no new inference is requested.':operation==='cancel'?'Requesting cancellation of the accepted job.':'Preparing or submitting the explicitly authorized Meta stage…'}</p>}
    {pending&&lastReply?.accounting&&<InferenceStageAccounting metrics={lastReply.accounting.request} usage={lastReply.accounting.actualUsage} stageLabel={`${lastReply.accounting.request.phase} request accounting`}/>}
    {latest && <article aria-label="Inspectable widget proposals"><h4 style={{ margin: '0 0 8px' }}>Plan for {latest.sectionTitle}</h4><p>{latest.summary}</p><InferenceStageAccounting metrics={latest.accounting?.request} usage={latest.accounting?latest.accounting.actualUsage:latest.usage} stageLabel={`${latest.action==='plan'?'Planning':latest.action==='edit'?'Settings edit':'Repair'} stage accounting`}/><p style={{ fontSize: '1rem' }}>{latest.model} · {latest.usage ? `${latest.usage.inputTokens.toLocaleString()} input / ${latest.usage.outputTokens.toLocaleString()} output tokens reported` : 'Provider token usage unavailable'} · cached locally; reopening does not create a response.</p>
      {latest.repetitionReason && <p>Repeated-type rationale: {latest.repetitionReason}</p>}{latest.warnings.map((w,i) => <p key={i}>{w}</p>)}
      {latest.rejected.length > 0 && <details><summary>{latest.rejected.length} rejected proposal(s)</summary><ul>{latest.rejected.map((r,i) => <li key={`${r.id}-${i}`}>{r.id}: {r.reason}</li>)}</ul></details>}
      <label><input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)}/> Show removed proposals</label>
      {latest.proposals.filter(p => showRemoved || data?.decisions[p.envelope.id] !== 'removed').map(proposal => <section key={proposal.envelope.id} style={{ borderTop: '1px solid var(--line)', padding: '16px 0', minWidth: 0 }}>
        <h4 style={{ margin: '0 0 8px' }}>{proposal.envelope.title} · {getWidgetDescriptor(proposal.envelope.spec.kind).label}</h4><p><strong>Concept:</strong> {proposal.concept}</p><p><strong>Why this view:</strong> {proposal.reason}</p><p><strong>Try:</strong> {proposal.objective}</p><p><strong>Data:</strong> {proposal.provenance}; {proposal.neededData.join('; ') || 'no additional data declared'}.</p><p><strong>Actual proposed controls:</strong> {proposal.interactions.join('; ') || 'no additional controls declared'}.</p><blockquote>{proposal.envelope.source.quote}</blockquote><a href={`#source-${source.id}-${proposal.envelope.source.blockId}`}>Return to the exact source passage</a>
        <p>{proposal.envelope.spec.mapping}</p>{proposal.limitations.length > 0 && <ul>{proposal.limitations.map((l,i) => <li key={i}>{l}</li>)}</ul>}
        {proposal.diff && <details open><summary>Review {proposal.diff.length} configuration change(s)</summary>{proposal.diff.map((change,i) => <div key={i}><strong>{change.path}</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '1rem' }}>{change.before}{'\n→ '}{change.after}</pre></div>)}<p>Applying refreshes this widget locally in a worker without another model request. Only the bounded widget configuration changes; source, evidence labels and engine implementations are protected.</p></details>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button disabled={!!pending} onClick={() => accept(proposal)}>Accept proposal</Button><Button variant="outline" onClick={() => setPreviewId(previewId === proposal.envelope.id ? '' : proposal.envelope.id)}>Preview supported widget</Button><Button variant="outline" onClick={() => patch(s => ({ ...s, decisions: { ...s.decisions, [proposal.envelope.id]: 'deferred' } }))}>Defer</Button><Button variant="ghost" onClick={() => patch(s => ({ ...s, decisions: { ...s.decisions, [proposal.envelope.id]: 'removed' } }))}>Remove proposal</Button></div>
        {data?.decisions[proposal.envelope.id] && <p>Local decision: {data.decisions[proposal.envelope.id]}</p>}
        {previewId === proposal.envelope.id && <Suspense fallback={<p>Loading the requested visual…</p>}><WidgetView envelope={proposal.envelope} source={source}/></Suspense>}
      </section>)}
    </article>}
    <details><summary>Repair or change one widget</summary><p>Repair can propose a replacement. A settings edit stays in the same widget type. Both preserve the exact source anchor; you review the difference before applying it.</p><label style={fieldStyle}>Current widget<select style={inputStyle} value={targetId} disabled={busy||!!pending} onChange={e => setTargetId(e.target.value)}><option value="">Choose one widget</option>{allWidgets.map(w => <option key={w.id} value={w.id}>{w.title} · {w.spec.kind}</option>)}</select></label><label style={{ ...fieldStyle, marginTop: 12 }}>Feedback or requested settings change<textarea style={{ ...inputStyle, minHeight: 96 }} maxLength={1200} value={feedback} disabled={busy||!!pending} onChange={e => setFeedback(e.target.value)} placeholder="For example: use a simpler input while keeping the same source mapping."/></label><p>Repair and settings edits each authorize one new Meta call, after the corresponding local context review below.</p>{target&&<><details><summary>Repair context: {repairReview.selection?.metrics.selectedCapabilities??0} selected capabilities</summary><InferenceContextReview selection={repairReview.selection} context={repairReview.context} error={repairReview.error} maxCalls={1} maxOutputTokens={6000} reservedTokenCeiling={302000}/></details><details><summary>Settings-edit context: {editReview.selection?.metrics.selectedCapabilities??0} selected capabilities</summary><InferenceContextReview selection={editReview.selection} context={editReview.context} error={editReview.error} maxCalls={1} maxOutputTokens={6000} reservedTokenCeiling={302000}/></details></>}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}><Button disabled={!policy.newModelAllowed||!target || !repairReview.ready || busy || !!pending || storageBlocked} onClick={() => void start('repair')}>Ask Meta to repair this widget</Button><Button variant="outline" disabled={!policy.newModelAllowed||!target || !editReview.ready || busy || !!pending || storageBlocked} onClick={() => void start('edit')}>Propose a settings edit</Button><Button variant="outline" disabled={!target || !data?.history[target.id]?.length || !!pending} onClick={() => target && undo(target.id)}>Undo accepted revision</Button></div></details>
    {renderAccepted && data?.accepted.length ? <details><summary>{data.accepted.length} accepted local widget(s)</summary>{data.accepted.map(w => <div key={w.id} style={{ padding: '12px 0' }}><strong>{w.title}</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button variant="outline" onClick={() => { setTargetId(w.id); setPreviewId(previewId === w.id ? '' : w.id); }}>Inspect accepted widget</Button><Button variant="ghost" disabled={!!pending} onClick={() => { patch(s => ({ ...s, accepted: s.accepted.filter(e => e.id !== w.id) })); onRemoveWidget?.(w.id); }}>Remove local widget</Button></div>{previewId === w.id && <Suspense fallback={<p>Loading the requested visual…</p>}><WidgetView envelope={w} source={source} onChange={envelope => { const valid = validateWidgetEnvelope(envelope,source); patch(s => ({ ...s, accepted: s.accepted.map(e => e.id === valid.id ? valid : e) })); onAcceptWidget?.(valid); }}/></Suspense>}</div>)}</details> : null}
  </section>;
}
