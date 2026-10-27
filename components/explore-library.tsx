'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, Compass, LoaderCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EXPLORE_CATEGORIES, EXPLORE_PAGE_SIZE, exploreParams, exploreQuerySchema, exploreResultSchema, paperUrl, readerUrl, type ArxivPaper, type ExploreQuery, type ExploreResult } from '@/shared/explore';
import { readSavedPapers, toggleSavedPaper, SAVED_PAPERS_KEY } from '@/lib/explore/saved';

const initialQuery: ExploreQuery = { q: '', field: 'all', category: 'cs.AI', since: '', sort: 'newest', start: 0 };
const topics = [
  { label: 'Language models', q: 'language models', category: 'cs.CL' },
  { label: 'Graph algorithms', q: 'graph', category: 'cs.DS' },
  { label: 'Optimization', q: 'optimization', category: 'math.OC' },
  { label: 'Computer vision', q: '', category: 'cs.CV' },
];
const date = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));

export function ExploreLibrary() {
  const [query, setQuery] = useState<ExploreQuery>(initialQuery);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<ArxivPaper[]>([]);
  const [storageError, setStorageError] = useState('');
  const [view, setView] = useState<'explore' | 'saved'>('explore');
  const [preview, setPreview] = useState<ArxivPaper | null>(null);
  const request = useRef<AbortController | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);

  function loadSaved() {
    try { setSaved(readSavedPapers(localStorage)); setStorageError(''); }
    catch { setStorageError('Your saved papers could not be read. Browser storage may be unavailable or the saved data needs attention. Existing data has been retained.'); }
  }
  async function search(next: ExploreQuery, options: { history?: boolean; focus?: boolean } = {}) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setQuery(next); setView('explore'); setResult(null); setError(''); setLoading(true);
    if (options.history !== false) window.history.pushState(null, '', `/explore?${exploreParams(next)}`);
    try {
      const response = await fetch(`/api/explore?${exploreParams(next)}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Search could not be completed. Try again.');
      const data = exploreResultSchema.parse(payload);
      if (!controller.signal.aborted) { setResult(data); if (options.focus) requestAnimationFrame(() => resultsHeading.current?.focus()); }
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Search could not be completed.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    function restore() {
      request.current?.abort(); setLoading(false); loadSaved();
      const params = new URLSearchParams(location.search);
      if (params.get('view') === 'saved') { setView('saved'); return; }
      const parsed = exploreQuerySchema.safeParse(params.size ? Object.fromEntries(params) : initialQuery);
      if (!parsed.success) { setView('explore'); setError('This search link contains invalid filters. Choose your filters and search again.'); return; }
      void search(parsed.data, { history: false });
    }
    restore();
    const sync = (event: StorageEvent) => { if (event.key === SAVED_PAPERS_KEY || event.key === null) loadSaved(); };
    window.addEventListener('popstate', restore); window.addEventListener('storage', sync);
    return () => { request.current?.abort(); window.removeEventListener('popstate', restore); window.removeEventListener('storage', sync); };
  }, []);
  function showSaved() {
    request.current?.abort(); setLoading(false); setView('saved'); loadSaved();
    window.history.pushState(null, '', '/explore?view=saved');
  }
  function toggle(paper: ArxivPaper) {
    try { setSaved(toggleSavedPaper(localStorage, paper)); setStorageError(''); }
    catch (problem) { setStorageError(problem instanceof Error ? problem.message : 'Your library could not be saved.'); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void search({ ...query, start: 0 }, { focus: true }); }
  const papers = view === 'saved' ? saved : result?.papers ?? [];
  return <div className="explore-page">
    <a className="skip-link" href="#explore-content">Skip to paper discovery</a>
    <header className="explore-header"><Link className="wordmark" href="/" aria-label="Paperplay home"><span className="brand-icon"><BookOpen size={19}/></span>paperplay<span className="wordmark-period">.</span></Link><nav aria-label="Main navigation"><Link href="/explore" aria-current="page"><Compass size={18}/>Explore</Link><Link href="/"><BookOpen size={18}/>Reader</Link></nav></header>
    <main id="explore-content" className="explore-content">
      <div className="explore-intro"><span className="explore-eyebrow">A PLACE FOR YOUR NEXT QUESTION</span><h1>Find a paper.<br/><em>Make sense of it.</em></h1><p>Explore research on arXiv. Keep what sparks your curiosity, then open a paper to read and experiment with its ideas.</p></div>
      <div className="explore-tabs" role="group" aria-label="Library view"><Button variant={view === 'explore' ? 'secondary' : 'ghost'} aria-pressed={view === 'explore'} onClick={() => void search(query, { history: true })}><Compass size={18}/>Discover papers</Button><Button variant={view === 'saved' ? 'secondary' : 'ghost'} aria-pressed={view === 'saved'} onClick={showSaved}><Bookmark size={18}/>Saved papers <span className="count-pill">{saved.length}</span></Button></div>
      {view === 'explore' && <>
        <form className="explore-search" onSubmit={submit} role="search" aria-label="Search arXiv papers">
          <div className="explore-search-row"><label className="explore-query">Topic, title or author<div><Search size={20} aria-hidden="true"/><input type="search" maxLength={200} value={query.q} onChange={event => setQuery({ ...query, q: event.target.value })} placeholder="What are you curious about?"/></div></label><Button type="submit"><Search size={18}/>Search arXiv</Button></div>
          <div className="explore-filters"><label>Search in<select value={query.field} onChange={event => setQuery({ ...query, field: event.target.value as ExploreQuery['field'] })}><option value="all">All fields</option><option value="title">Title</option><option value="author">Author</option></select></label><label>Subject<select value={query.category} onChange={event => setQuery({ ...query, category: event.target.value })}>{EXPLORE_CATEGORIES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Published since<select value={query.since} onChange={event => setQuery({ ...query, since: event.target.value })}><option value="">Any time</option>{[new Date().getUTCFullYear(), new Date().getUTCFullYear() - 1, new Date().getUTCFullYear() - 2, 2020, 2010].filter((year, index, years) => years.indexOf(year) === index).map(year => <option key={year} value={year}>{year}</option>)}</select></label><label>Sort by<select value={query.sort} onChange={event => setQuery({ ...query, sort: event.target.value as ExploreQuery['sort'] })}><option value="relevance">Relevance</option><option value="newest">Newest first</option><option value="updated">Recently updated</option></select></label></div>
        </form>
        <div className="explore-topics"><span>Follow a thread</span>{topics.map(topic => <Button variant="outline" key={topic.label} onClick={() => void search({ ...initialQuery, q: topic.q, category: topic.category, sort: topic.q ? 'relevance' : 'newest' }, { focus: true })}>{topic.label}<ArrowRight size={14}/></Button>)}</div>
      </>}
      <section aria-labelledby="explore-results-heading" aria-busy={loading}>
        <div className="explore-results-header"><h2 id="explore-results-heading" ref={resultsHeading} tabIndex={-1}>{view === 'saved' ? 'Your reading list' : result?.query.q ? `Results for “${result.query.q}”` : 'Fresh from arXiv'}</h2><span role="status">{loading ? 'Searching arXiv…' : view === 'saved' ? `${saved.length} saved ${saved.length === 1 ? 'paper' : 'papers'}` : result ? `${result.total.toLocaleString('en')} matching papers` : ''}</span></div>
        {storageError && <p role="alert" className="explore-message">{storageError}</p>}
        {view === 'saved' && <p className="explore-note">Saved in this browser. Opening a paper imports its source; figures are generated only when you ask Meta.</p>}
        {loading && <div className="explore-empty"><LoaderCircle size={28} className="import-spinner" aria-hidden="true"/><p>Looking for your next read.</p><span>arXiv can take a moment to respond.</span></div>}
        {view === 'explore' && error && <div className="explore-empty"><p role="alert">{error}</p><Button variant="outline" onClick={() => void search(query)}>Try search again</Button><a href="https://arxiv.org/search/" target="_blank" rel="noreferrer">Browse arXiv directly <ArrowUpRight size={15}/></a></div>}
        {!loading && !(view === 'explore' && error) && papers.length === 0 && <div className="explore-empty"><Bookmark size={28} aria-hidden="true"/><h3>{view === 'saved' ? 'Keep a little curiosity for later.' : 'No papers found for these filters.'}</h3><p>{view === 'saved' ? 'Save a paper from Discover and it will be waiting here.' : 'Try fewer words, a broader subject or an earlier date.'}</p>{view === 'saved' && <Button variant="outline" onClick={() => void search(query)}>Discover papers</Button>}</div>}
        <div className="explore-grid">{papers.map(paper => <PaperCard key={paper.id} paper={paper} saved={saved.some(item => item.id === paper.id)} toggle={() => toggle(paper)} preview={() => setPreview(paper)}/>)}</div>
        {view === 'explore' && result && !loading && <nav className="explore-pagination" aria-label="Search result pages"><Button variant="outline" disabled={result.query.start === 0} onClick={() => void search({ ...result.query, start: result.query.start - EXPLORE_PAGE_SIZE }, { focus: true })}>Previous</Button><span>{result.total === 0 ? '0 results' : `${result.query.start + 1}–${result.query.start + result.papers.length} of ${result.total.toLocaleString('en')}`}</span><Button variant="outline" disabled={result.query.start + EXPLORE_PAGE_SIZE >= result.total || result.query.start >= 996 || !result.papers.length} onClick={() => void search({ ...result.query, start: result.query.start + EXPLORE_PAGE_SIZE }, { focus: true })}>Next</Button></nav>}
        {view === 'explore' && result && <p className="explore-note">Metadata from arXiv · retrieved {date(new Date(result.fetchedAt).toISOString())}. {result.total > 1008 ? 'Refine your search to explore beyond the first 1,008 matches. ' : ''}Search and saving use no Meta credits.</p>}
      </section>
      <footer className="explore-footer">Research by its authors. Discovery through arXiv. Understanding, one experiment at a time.</footer>
    </main>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="explore-preview">{preview && <><span className="explore-eyebrow">ARXIV · {preview.id}</span><DialogTitle>{preview.title}</DialogTitle><DialogDescription>{preview.authors.join(' · ')}</DialogDescription><p className="explore-note">Submitted {date(preview.published)} · updated {date(preview.updated)}</p><h3>Abstract</h3><p className="explore-full-abstract">{preview.abstract || 'No abstract was provided by arXiv.'}</p><div className="explore-card-actions"><Link className="explore-open" href={readerUrl(preview.id)}>Open in Paperplay <ArrowRight size={17}/></Link><Button variant="outline" aria-pressed={saved.some(item => item.id === preview.id)} onClick={() => toggle(preview)}><Bookmark size={16}/>{saved.some(item => item.id === preview.id) ? 'Saved' : 'Save paper'}</Button><a href={paperUrl(preview.id)} target="_blank" rel="noreferrer">Original on arXiv <ArrowUpRight size={15}/></a></div><p className="explore-note">This is the authors’ abstract. Opening imports the source for reading; Meta analysis is a separate choice.</p>{storageError && <p role="alert">{storageError}</p>}</>}</DialogContent></Dialog>
  </div>;
}

function PaperCard({ paper, saved, toggle, preview }: { paper: ArxivPaper; saved: boolean; toggle: () => void; preview: () => void }) {
  return <article className="explore-card"><div className="explore-card-meta"><span>{paper.categories[0] || 'arXiv'} · {date(paper.published)}</span><Button variant="ghost" size="icon" aria-label={`${saved ? 'Unsave' : 'Save'} ${paper.title}`} aria-pressed={saved} onClick={toggle}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'}/></Button></div><h3><button type="button" onClick={preview}>{paper.title}</button></h3><p className="explore-authors">{paper.authors.slice(0, 4).join(' · ')}{paper.authors.length > 4 ? ` · +${paper.authors.length - 4} authors` : ''}</p><p className="explore-abstract">{paper.abstract || 'No abstract was provided by arXiv.'}</p><button type="button" className="explore-abstract-link" onClick={preview} aria-label={`Read abstract: ${paper.title}`}>Read abstract <ArrowUpRight size={15}/></button><div className="explore-card-actions"><Link className="explore-open" href={readerUrl(paper.id)}>Open in Paperplay <ArrowRight size={16}/></Link><a href={paperUrl(paper.id)} target="_blank" rel="noreferrer" aria-label={`View ${paper.title} on arXiv`}>arXiv <ArrowUpRight size={15}/></a></div></article>;
}
