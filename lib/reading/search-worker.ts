import { buildSearchEntries, searchEntries, sourceText, type PersonalNote, type SearchEntry } from './personal';
import type { SourceDocument } from '../../shared/schema';
let index: SearchEntry[] = [];
self.onmessage = (event: MessageEvent<{ kind: 'index'|'search'; id: number; sources?: SourceDocument[]; notes?: PersonalNote[]; query?: string }>) => {
  const request = event.data;
  try {
    if (!Number.isInteger(request.id)) throw Error('Invalid local search request.');
    if (request.kind === 'index') {
      if (!Array.isArray(request.sources) || request.sources.length > 100 || !Array.isArray(request.notes) || request.notes.length > 300 || JSON.stringify(request).length > 8_000_000) throw Error('The local search corpus exceeds its current bounds.');
      index = buildSearchEntries(request.sources, request.notes);
      return self.postMessage({ kind: 'ready', id: request.id, count: index.length, limited: index.length >= 10_000 || request.sources.reduce((sum,source)=>sum+source.blocks.reduce((n,block)=>n+sourceText(block).length,0),0) > 2_000_000 });
    }
    if (request.kind !== 'search' || typeof request.query !== 'string' || request.query.length > 200) throw Error('Search exceeded its local limits.');
    self.postMessage({ kind: 'results', id: request.id, results: searchEntries(index, request.query) });
  } catch (error) { self.postMessage({ kind: 'error', id: request.id, error: error instanceof Error ? error.message : 'This local index could not be searched.' }); }
};
