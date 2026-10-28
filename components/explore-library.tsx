'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, Compass, LoaderCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ARXIV_GROUPS, ARXIV_ARCHIVES, ARXIV_SUBJECTS, exploreSubjectGroup, exploreSubjectLabel, EXPLORE_PAGE_SIZE, exploreParams, exploreQuerySchema, exploreResultSchema, paperUrl, readerUrl, type ArxivPaper, type ExploreQuery, type ExploreResult } from '@/shared/explore';
import { readSavedPapers, toggleSavedPaper, filterSavedPapers, SAVED_PAPERS_KEY } from '@/lib/explore/saved';

const initialQuery: ExploreQuery = { q: '', field: 'all', category: '', since: '', sort: 'newest', start: 0 };
const topics = [
  { label: 'Language models', q: 'language models', category: 'cs.CL' },
  { label: 'Graph algorithms', q: 'graph', category: 'cs.DS' },
  { label: 'Optimization', q: 'optimization', category: 'math.OC' },
  { label: 'Quantum physics', q: '', category: 'quant-ph' },
  { label: 'Biological networks', q: '', category: 'q-bio.MN' },
  { label: 'Climate & oceans', q: '', category: 'physics.ao-ph' },
];
const date = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));

export function ExploreLibrary() {
  const [query, setQuery] = useState<ExploreQuery>(initialQuery);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<ArxivPaper[]>([]);
  const [storageError, setStorageError] = useState('');
  const [savedQuery,setSavedQuery]=useState('');const [notice,setNotice]=useState('');
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
    setNotice('');setQuery(next); setView('explore'); setResult(null); setError(''); setLoading(true);
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
      if (!parsed.success) { setResult(null);setView('explore'); setError('This search link contains invalid filters. Choose your filters and search again.'); return; }
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
    try { const next=toggleSavedPaper(localStorage,paper);setSaved(next);setNotice(next.some(item=>item.id===paper.id)?'Saved to your reading list.':'Removed from your reading list. The imported paper is unchanged.');setStorageError(''); }
    catch (problem) { setStorageError(problem instanceof Error ? problem.message : 'Your library could not be saved.'); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void search({ ...query, start: 0 }, { focus: true }); }
  const subjectGroup=exploreSubjectGroup(query.category);
  const browseSubject=(category:string)=>void search({...query,q:'',category,start:0,sort:'newest'},{focus:true});
  const papers = view === 'saved' ? filterSavedPapers(saved,savedQuery) : result?.papers ?? [];
  return <div className="explore-page">
    <a className="skip-link" href="#explore-content">Skip to paper discovery</a>
    <header className="explore-header"><Link className="wordmark" href="/" aria-label="Paperplay home"><span className="brand-icon"><BookOpen size={19}/></span>paperplay<span className="wordmark-period">.</span></Link><nav aria-label="Main navigation"><Link href="/explore" aria-current="page"><Compass size={18}/>Explore</Link><Link href="/"><BookOpen size={18}/>Reader</Link></nav></header>
    <main id="explore-content" className="explore-content">
      <div className="explore-intro"><span className="explore-eyebrow">A PLACE FOR YOUR NEXT QUESTION</span><h1>Find your next paper.</h1><p>Browse every arXiv subject, save a paper, and open it with source-linked figures chosen by Meta.</p></div>
      <div className="explore-tabs" role="group" aria-label="Library view"><Button variant={view === 'explore' ? 'secondary' : 'ghost'} aria-pressed={view === 'explore'} onClick={() => void search(query, { history: true })}><Compass size={18}/>Discover papers</Button><Button variant={view === 'saved' ? 'secondary' : 'ghost'} aria-pressed={view === 'saved'} onClick={showSaved}><Bookmark size={18}/>Saved papers <span className="count-pill">{saved.length}</span></Button></div>
      {notice&&<p className="explore-notice" role="status">{notice}</p>}
      {view === 'explore' && <>
        <nav className="explore-subjects" aria-label="Browse arXiv subjects"><div className="explore-subjects-heading"><h2>Explore by subject</h2><span>{ARXIV_SUBJECTS.length} categories across all {ARXIV_GROUPS.length} arXiv groups</span></div><div className="explore-subject-groups"><Button variant={!subjectGroup?'secondary':'outline'} aria-pressed={!subjectGroup} onClick={()=>browseSubject('')}>All subjects</Button>{ARXIV_GROUPS.map(group=><Button key={group.id} variant={subjectGroup===group.id?'secondary':'outline'} aria-pressed={subjectGroup===group.id} onClick={()=>browseSubject(`group:${group.id}`)}>{group.label}</Button>)}</div>{subjectGroup==='physics'&&<div className="explore-archives" role="group" aria-label="Physics archives">{ARXIV_ARCHIVES.map(archive=><Button key={archive.id} variant={query.category===`archive:${archive.id}`?'secondary':'ghost'} aria-pressed={query.category===`archive:${archive.id}`} onClick={()=>browseSubject(`archive:${archive.id}`)}>{archive.label}</Button>)}</div>}</nav>
        <form className="explore-search" onSubmit={submit} role="search" aria-label="Search arXiv papers">
          <div className="explore-search-row"><label className="explore-query">Topic, title or author<div><Search size={20} aria-hidden="true"/><input type="search" maxLength={200} value={query.q} onChange={event => setQuery({ ...query, q: event.target.value })} placeholder="What are you curious about?"/></div></label><Button type="submit"><Search size={18}/>Search arXiv</Button></div>
          <div className="explore-filters"><label>Search in<select value={query.field} onChange={event => setQuery({ ...query, field: event.target.value as ExploreQuery['field'] })}><option value="all">All fields</option><option value="title">Title</option><option value="author">Author</option></select></label><label>Category<select value={query.category} onChange={event => void search({ ...query, category: event.target.value,start:0 },{focus:true})}><option value="">All subjects</option>{ARXIV_GROUPS.filter(group=>!subjectGroup||group.id===subjectGroup).map(group=><optgroup key={group.id} label={group.label}><option value={`group:${group.id}`}>All {group.label}</option>{ARXIV_ARCHIVES.filter(archive=>archive.group===group.id).map(archive=><option key={archive.id} value={`archive:${archive.id}`}>All {archive.label}</option>)}{ARXIV_SUBJECTS.filter(item=>item.group===group.id).map(item=><option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</optgroup>)}</select></label><label>Published since<select value={query.since} onChange={event => setQuery({ ...query, since: event.target.value })}><option value="">Any time</option>{[new Date().getUTCFullYear(), new Date().getUTCFullYear() - 1, new Date().getUTCFullYear() - 2, 2020, 2010].filter((year, index, years) => years.indexOf(year) === index).map(year => <option key={year} value={year}>{year}</option>)}</select></label><label>Sort by<select value={query.sort} onChange={event => setQuery({ ...query, sort: event.target.value as ExploreQuery['sort'] })}><option value="relevance">Relevance</option><option value="newest">Newest first</option><option value="updated">Recently updated</option></select></label></div>
          <div className="explore-search-actions"><Button variant="ghost" type="button" onClick={()=>void search({...query,field:'all',category:'',since:'',sort:'relevance',start:0},{focus:true})}>Clear filters</Button>{loading&&<Button variant="ghost" type="button" onClick={()=>{request.current?.abort();setLoading(false);setError('Search cancelled. Change the filters or search again when ready.');}}>Cancel search</Button>}<span>Search a phrase, title or author. No Meta credits used.</span></div>
        </form>
        <div className="explore-topics"><span>Follow a thread</span>{topics.map(topic => <Button variant="outline" key={topic.label} onClick={() => void search({ ...initialQuery, q: topic.q, category: topic.category, sort: topic.q ? 'relevance' : 'newest' }, { focus: true })}>{topic.label}<ArrowRight size={14}/></Button>)}</div>
      </>}
      <section aria-labelledby="explore-results-heading" aria-busy={loading}>
        <div className="explore-results-header"><h2 id="explore-results-heading" ref={resultsHeading} tabIndex={-1}>{view === 'saved' ? 'Your reading list' : result?.query.q ? `Results for “${result.query.q}”` : result?.query.category ? exploreSubjectLabel(result.query.category) : 'Fresh from arXiv'}</h2><span role="status">{loading ? 'Searching arXiv…' : view === 'saved' ? `${papers.length} of ${saved.length} saved papers` : result ? `${result.total.toLocaleString('en')} matching papers` : ''}</span></div>
        {storageError && <p role="alert" className="explore-message">{storageError}</p>}
        {view==='saved'&&<label className="explore-saved-search">Find in your reading list<input type="search" maxLength={200} value={savedQuery} onChange={event=>setSavedQuery(event.target.value)} placeholder="Title, author or topic…"/>{savedQuery&&<Button variant="ghost" onClick={()=>setSavedQuery('')}>Clear search</Button>}</label>}
        {view === 'saved' && <p className="explore-note">Saved in this browser. Opening a paper imports its source; figures are generated only when you ask Meta.</p>}
        {loading && <div className="explore-empty"><LoaderCircle size={28} className="import-spinner" aria-hidden="true"/><p>Looking for your next read.</p><span>arXiv can take a moment to respond.</span></div>}
        {view === 'explore' && error && <div className="explore-empty"><p role="alert">{error}</p><Button variant="outline" onClick={() => void search(query)}>Try search again</Button><a href="https://arxiv.org/search/" target="_blank" rel="noreferrer">Browse arXiv directly <ArrowUpRight size={15}/></a></div>}
        {!loading && !(view === 'explore' && error) && papers.length === 0 && <div className="explore-empty"><Bookmark size={28} aria-hidden="true"/><h3>{view === 'saved' ? savedQuery?'No saved papers match this search.':'Keep a little curiosity for later.' : 'No papers found for these filters.'}</h3><p>{view === 'saved' ? savedQuery?'Try a shorter title, author name or topic.':'Save a paper from Discover and it will be waiting here.' : 'Try fewer words, a broader subject or an earlier date.'}</p>{view === 'saved' && <Button variant="outline" onClick={() => void search(query)}>Discover papers</Button>}</div>}
        <div className="explore-grid">{papers.map(paper => <PaperCard key={paper.id} paper={paper} saved={saved.some(item => item.id === paper.id)} toggle={() => toggle(paper)} preview={() => setPreview(paper)} onCategory={browseSubject}/>)}</div>
        {view === 'explore' && result && !loading && <nav className="explore-pagination" aria-label="Search result pages"><Button variant="outline" disabled={result.query.start === 0} onClick={() => void search({ ...result.query, start: result.query.start - EXPLORE_PAGE_SIZE }, { focus: true })}>Previous</Button><span>{result.total === 0 ? '0 results' : `${result.query.start + 1}–${result.query.start + result.papers.length} of ${result.total.toLocaleString('en')}`}</span><Button variant="outline" disabled={result.query.start + EXPLORE_PAGE_SIZE >= result.total || result.query.start >= 996 || !result.papers.length} onClick={() => void search({ ...result.query, start: result.query.start + EXPLORE_PAGE_SIZE }, { focus: true })}>Next</Button></nav>}
        {view === 'explore' && result && <p className="explore-note">Metadata from arXiv · retrieved {date(new Date(result.fetchedAt).toISOString())}. {result.total > 1008 ? 'Refine your search to explore beyond the first 1,008 matches. ' : ''}Search and saving use no Meta credits.</p>}
      </section>
      <footer className="explore-footer">Research by its authors. Discovery through arXiv. Understanding, one experiment at a time.</footer>
    </main>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="explore-preview">{preview && <><span className="explore-eyebrow">ARXIV · {preview.id}</span><DialogTitle>{preview.title}</DialogTitle><DialogDescription>{preview.authors.join(' · ')}</DialogDescription><p className="explore-note">Submitted {date(preview.published)} · updated {date(preview.updated)}</p><div className="explore-category-tags" aria-label="Paper subjects">{preview.categories.filter(category=>ARXIV_SUBJECTS.some(item=>item.value===category)).map(category=><Button key={category} variant="outline" onClick={()=>{setPreview(null);browseSubject(category);}}>{exploreSubjectLabel(category)}</Button>)}</div><h3>Abstract</h3><p className="explore-full-abstract">{preview.abstract || 'No abstract was provided by arXiv.'}</p><div className="explore-card-actions"><Link className="explore-open" href={readerUrl(preview.id)}>Open in Paperplay <ArrowRight size={17}/></Link><Button variant="outline" aria-pressed={saved.some(item => item.id === preview.id)} onClick={() => toggle(preview)}><Bookmark size={16}/>{saved.some(item => item.id === preview.id) ? 'Saved' : 'Save paper'}</Button><a href={paperUrl(preview.id)} target="_blank" rel="noreferrer">Original on arXiv <ArrowUpRight size={15}/></a></div><p className="explore-note">This is the authors’ abstract. Opening prepares the source and automatically asks Meta to choose helpful figures, including a custom figure. Saved results are reused.</p>{notice&&<p role="status">{notice}</p>}{storageError && <p role="alert">{storageError}</p>}</>}</DialogContent></Dialog>
  </div>;
}

function PaperCard({ paper, saved, toggle, preview, onCategory }: { paper: ArxivPaper; saved: boolean; toggle: () => void; preview: () => void; onCategory:(category:string)=>void }) {
  return <article className="explore-card"><div className="explore-card-meta"><span>{paper.categories[0] || 'arXiv'} · {date(paper.published)}</span><Button variant="ghost" size="icon" aria-label={`${saved ? 'Unsave' : 'Save'} ${paper.title}`} aria-pressed={saved} onClick={toggle}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'}/></Button></div><h3><Link href={readerUrl(paper.id)}>{paper.title}</Link></h3><p className="explore-authors">{paper.authors.slice(0, 4).join(' · ')}{paper.authors.length > 4 ? ` · +${paper.authors.length - 4} authors` : ''}</p><div className="explore-category-tags" aria-label="Paper subjects">{paper.categories.filter(category=>ARXIV_SUBJECTS.some(item=>item.value===category)).slice(0,4).map(category=><button type="button" key={category} onClick={()=>onCategory(category)}>{exploreSubjectLabel(category)}</button>)}</div><p className="explore-abstract">{paper.abstract || 'No abstract was provided by arXiv.'}</p><button type="button" className="explore-abstract-link" onClick={preview} aria-label={`Read abstract: ${paper.title}`}>Read abstract <ArrowUpRight size={15}/></button><div className="explore-card-actions"><Link className="explore-open" href={readerUrl(paper.id)}>Open in Paperplay <ArrowRight size={16}/></Link><a href={paperUrl(paper.id)} target="_blank" rel="noreferrer" aria-label={`View ${paper.title} on arXiv`}>arXiv <ArrowUpRight size={15}/></a></div></article>;
}
