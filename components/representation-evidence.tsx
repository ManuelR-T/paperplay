'use client';
import { useEffect, useState } from 'react';
import type { RepresentationPlan } from '@/shared/representations';
import { assessScientificEvidence, type SubjectEvidence } from '@/lib/representations/evidence';

export function RepresentationEvidence({plan}:{plan:RepresentationPlan}) {
  const [result,setResult]=useState<SubjectEvidence[]>([]);const [error,setError]=useState('');
  useEffect(()=>{let active=true;setResult([]);setError('');void assessScientificEvidence(plan).then(items=>{if(active)setResult(items);}).catch(()=>{if(active)setError('Evidence identity could not be checked. No verification label is granted.');});return()=>{active=false;};},[plan]);
  return <section aria-label="Scientific provenance"><h3>Scientific provenance</h3><p className="reader-hint">A source quote, a declared data origin and a computed example are different kinds of evidence. Requested evidence is a goal, not a verification result.</p>
    {error&&<p role="alert">{error}</p>}<dl>{result.map(item=><div key={`${item.subject.kind}:${item.subject.id}`} style={{padding:'12px 0',borderBottom:'1px solid var(--reader-line,var(--line))'}}><dt><strong>{item.subject.kind}: {item.subject.id}</strong></dt><dd style={{margin:0}}>{item.label}{item.origins.length>0&&<p className="reader-hint">Declared origin: {item.origins.map(origin=>origin.replaceAll('-',' ')).join(' · ')}</p>}</dd></div>)}</dl>
    {plan.evidence?.map(item=><details key={item.id}><summary>Provenance details: {item.id}</summary>{item.assumptions.map((value,i)=><p key={i}>Assumption: {value}</p>)}{item.references.map((reference,i)=><p key={i}>{reference.label}: {reference.location}</p>)}{item.anchorIds.map(id=><blockquote key={id} className="passage-quotation">{plan.anchors.find(anchor=>anchor.id===id)!.quote}</blockquote>)}</details>)}
    {!!plan.reportedChecks?.length&&<details><summary>Reported check history · not reverified</summary><p>These portable reports are retained for inspection. Importing them does not establish that an independent check passed in this application.</p>{plan.reportedChecks.map((report,index)=><p key={index}>{report.checkId} · {report.reference} · {report.scope} · reported {report.passed?'pass':'failure'}: {report.details}</p>)}</details>}
  </section>;
}
