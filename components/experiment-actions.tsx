'use client';

import { ShortLinkActions } from './short-link-actions';
import { useState } from 'react';
import { Download, Link2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { createExperimentBundle, encodePublicSnapshot, type BundleAttribution } from '@/lib/snapshots';
import type { ExperimentSnapshot, SourceDocument } from '@/shared/schema';
import { preparedPapers } from '@/data/papers';

export function ExperimentActions({ source, snapshot, original, originalName, attribution }: { source: SourceDocument; snapshot: ExperimentSnapshot; original?: Blob; originalName?: string; attribution?: BundleAttribution }) {
  const [open, setOpen] = useState(false);
  const [includeSource, setIncludeSource] = useState(false);
  const [includePdf, setIncludePdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const publicSource = preparedPapers.some(item => item.document.id === source.id && snapshot.figure.id === `${item.id}-primary`);
  async function share() {
    try {
      const url = `${location.origin}${location.pathname}#snapshot=${encodePublicSnapshot(snapshot)}`;
      setLink(url);
      try { await navigator.clipboard.writeText(url); setMessage('Snapshot link copied. It contains input and controls, not the PDF.'); }
      catch { setMessage('Copy the snapshot link below. It contains input and controls, not the PDF.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The snapshot could not be shared.'); }
  }
  async function download() {
    setBusy(true); setMessage('');
    try {
      const text = await createExperimentBundle({ source, snapshot, original, originalName, attribution, includeSource, includePdf });
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `paperplay-${source.id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0,60)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Exported ${includePdf ? 'source text and original PDF' : includeSource ? 'source text' : 'metadata and experiment only'}. No provider access token is included.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The experiment could not be exported.'); }
    finally { setBusy(false); }
  }
  return <div className="experiment-actions">
    {publicSource && <Button variant="outline" size="sm" onClick={() => void share()}><Link2 size={16}/>Share snapshot</Button>}
    {publicSource && <ShortLinkActions snapshot={snapshot}/>}
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); setMessage(''); }}><Download size={16}/>Export experiment</Button>
    {message && !open && <p role="status">{message}</p>}{link && !open && <label className="snapshot-link">Snapshot URL<input aria-label="Snapshot URL" readOnly value={link} onFocus={event => event.target.select()}/></label>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="transfer-dialog">
      <DialogTitle>Export this experiment</DialogTitle><DialogDescription>The bundle contains this figure, input, seed, engine versions and source attribution. Open it with “Open bundle” on another browser. It includes no API credentials or analysis job access.</DialogDescription>
      {!publicSource && <p>A metadata-only bundle needs the same source on the receiving device. A URL cannot transfer your locally stored PDF.</p>}
      <label className="inclusion-choice"><input type="checkbox" checked={includeSource} onChange={event => { setIncludeSource(event.target.checked); if (!event.target.checked) setIncludePdf(false); }}/><span>Include source text <small>Explicitly add the normalized paper text. Share only content you are allowed to redistribute.</small></span></label>
      <label className="inclusion-choice"><input type="checkbox" checked={includePdf} disabled={!includeSource || !original} onChange={event => setIncludePdf(event.target.checked)}/><span>Include original PDF <small>{original ? 'Adds the complete local PDF to this file.' : 'The original PDF is not stored for this figure.'}</small></span></label>
      <p>Included: {includePdf ? 'experiment, attribution, source text and PDF' : includeSource ? 'experiment, attribution and source text' : 'experiment and attribution only'}.</p>
      <Button onClick={() => void download()} disabled={busy}>{busy ? 'Preparing bundle…' : 'Download bundle'}</Button>{message && <p role="status">{message}</p>}
    </DialogContent></Dialog>
  </div>;
}
