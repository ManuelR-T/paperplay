'use client';

import type { ReactNode } from 'react';
import { ChevronDown, Library } from 'lucide-react';
import { Popover } from 'radix-ui';
import './library-menu.css';

/** Header paper switcher: the library lives here so the reading rail only carries the current paper's contents. */
export function LibraryMenu({ open, onOpenChange, current, children }: { open: boolean; onOpenChange: (open: boolean) => void; current: string; children: ReactNode }) {
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger className="library-trigger" aria-label={`Library: reading ${current}`}><Library size={17} aria-hidden="true"/><span className="library-trigger-label">{current}</span><ChevronDown size={15} aria-hidden="true"/></Popover.Trigger>
    <Popover.Portal><Popover.Content className="library-popover" align="start" sideOffset={10} collisionPadding={12} aria-label="Library">{children}</Popover.Content></Popover.Portal>
  </Popover.Root>;
}
