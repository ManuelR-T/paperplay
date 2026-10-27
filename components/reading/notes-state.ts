'use client';
import { useSyncExternalStore } from 'react';
import { readNotes, NOTES_KEY, type PersonalNote } from '@/lib/reading/personal';

type Notebook = { notes: PersonalNote[]; warning: string };
const empty: Notebook = { notes: [], warning: '' };
let value = empty;
let initialized = false;
const listeners = new Set<() => void>();
function refresh() {
  try { value = { notes: readNotes(), warning: '' }; }
  catch { value = { notes: value.notes, warning: 'The local notebook could not be read. Existing visible notes were retained; use an exported backup if storage is unavailable.' }; }
  initialized = true;
  for (const listener of listeners) listener();
}
function storageChanged(event: StorageEvent) { if (event.key === NOTES_KEY || event.key === null) refresh(); }
function subscribe(listener: () => void) {
  if (!listeners.size) { window.addEventListener('paperplay:notes-changed',refresh);window.addEventListener('storage',storageChanged); }
  listeners.add(listener);
  return () => { listeners.delete(listener);if(!listeners.size){window.removeEventListener('paperplay:notes-changed',refresh);window.removeEventListener('storage',storageChanged);} };
}
function snapshot() { if(!initialized&&typeof window!=='undefined')refresh();return value; }
/** Parse the bounded notebook once, rather than once per paragraph in a long article. */
export function usePersonalNotes() { return useSyncExternalStore(subscribe,snapshot,()=>empty); }
