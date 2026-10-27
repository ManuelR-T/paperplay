'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from './ui/button';
import type { ExperimentSnapshot } from '@/shared/schema';

const managedLinkSchema = z.strictObject({ id: z.string().regex(/^[a-f0-9]{32}$/), path: z.string().regex(/^\/s\/[a-f0-9]{32}$/), expiresAt: z.number().finite().min(0), deleteToken: z.string().regex(/^[a-f0-9]{64}$/), documentId: z.string().min(1).max(100) });
type ManagedLink = z.infer<typeof managedLinkSchema>;
const storageKey = 'paperplay:public-links:v1';
function loadLinks(): ManagedLink[] {
  const raw = localStorage.getItem(storageKey);
  return raw && raw.length <= 1_000_000 ? z.array(managedLinkSchema).max(1000).parse(JSON.parse(raw)).filter(item => item.expiresAt > Date.now()) : [];
}
export function ShortLinkActions({ snapshot }: { snapshot: ExperimentSnapshot }) {
  const [links, setLinks] = useState<ManagedLink[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { setLinks(loadLinks()); } catch { setMessage('Saved public-link deletion controls are unavailable. Existing links expire after seven days.'); } }, []);
  function remember(next: ManagedLink[]) {
    setLinks(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); return true; }
    catch { setMessage('The link exists, but its deletion control could not be saved. Keep this page open to delete it; otherwise it expires after seven days.'); return false; }
  }
  async function create() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/short-links', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot }) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'The public link could not be created.');
      const link = managedLinkSchema.parse({ ...body, documentId: snapshot.documentId });
      let previous = links;
      try { previous = loadLinks(); } catch { /* current controls remain usable */ }
      const saved = remember([link, ...previous.filter(item => item.id !== link.id)].slice(0, 1000));
      if (saved) setMessage('Public link created. Only this demo’s input, seed and engine settings were stored. Deletion control is saved in this browser.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The public link could not be created.'); }
    finally { setBusy(false); }
  }
  async function remove(link: ManagedLink) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/short-links', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: link.id, deleteToken: link.deleteToken }) });
      const body = await response.json();
      if (!response.ok && response.status !== 404) throw new Error(typeof body.error === 'string' ? body.error : 'Deletion could not be confirmed.');
      let previous = links; try { previous = loadLinks(); } catch { /* use current view */ }
      remember(previous.filter(item => item.id !== link.id));
      setMessage(response.ok ? 'Public snapshot content deleted. Minimal creation metadata remains until expiry to enforce abuse limits.' : 'This link is already absent or expired; its local deletion control was removed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Deletion could not be confirmed.'); }
    finally { setBusy(false); }
  }
  const visible = links.filter(link => link.documentId === snapshot.documentId);
  return <details className="short-link-actions" style={{ width: '100%', fontSize: 14 }}><summary>Optional 7-day public link</summary>
    <p>Explicitly store this public demo’s input, seed and engine settings for seven days. Paper text, local documents and PDFs are never uploaded by this action. Anyone with access to this site and the link can open the snapshot.</p>
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void create()}>{busy ? 'Working…' : 'Create 7-day link'}</Button>
    {visible.map(link => <div key={link.id} style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', overflowWrap: 'anywhere' }}>
      <a href={link.path} target="_blank" rel="noreferrer">{typeof location === 'undefined' ? link.path : `${location.origin}${link.path}`}</a>
      <p>Expires {new Date(link.expiresAt).toLocaleString()}. The deletion capability is private to this browser.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(`${location.origin}${link.path}`).then(() => setMessage('Public link copied. The deletion capability was not copied.')).catch(() => setMessage('Copy the public link shown above.'))}>Copy public link</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void remove(link)}>Delete public link</Button></div>
    </div>)}
    {message && <p role="status">{message}</p>}
  </details>;
}
