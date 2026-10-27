'use client';

import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { SourceDocument } from '@/shared/schema';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

export function SourceInformation({ source, description, children }: { source: SourceDocument; description: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="source-information">
    <span>{source.source.kind === 'prepared' ? 'Selected passages' : 'Imported source'} · interactive figures by Paperplay</span>
    <Button variant="ghost" onClick={() => setOpen(true)}><Info size={16}/>About this source</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reader-dialog">
      <DialogTitle>About this source</DialogTitle><DialogDescription>{description}</DialogDescription>
      <p>Original text belongs to the paper’s authors. Paperplay’s interactive figures are additions; their assumptions and evidence are available in each figure.</p>
      {source.extractionWarnings.length > 0 && <section><h3>Reading limitations</h3><ul>{source.extractionWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
      {children}
    </DialogContent></Dialog>
  </div>;
}
