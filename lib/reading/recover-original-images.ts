import { parseArxivId } from '../../shared/arxiv-id';
import type { SourceDocument } from '../../shared/schema';

type Figure = Extract<SourceDocument['blocks'][number], {kind:'original-figure'}>;
const requests = new Map<string, Promise<Figure[]>>();
const captionKey = (value:string) => value.replace(/\s+/g,' ').trim();

/** Recover only image references from the exact saved edition; never replace its text or anchors. */
export async function recoverOriginalFigure(url:string, caption:string, fetcher:typeof fetch=fetch):Promise<Figure|undefined> {
  const id=parseArxivId(url);
  if(!/v\d+$/.test(id)) return undefined; // An unpinned lookup could attach a revised paper's figure.
  let request=requests.get(id);
  if(!request){
    request=(async()=>{
      const response=await fetcher(`/api/arxiv/figures?id=${encodeURIComponent(id)}`);
      if(!response.ok) throw new Error('Original image recovery unavailable.');
      const payload=await response.json();
      if(payload.kind!=='html'||payload.arxivId!==id) return [];
      return (payload.figures as SourceDocument['blocks']).filter((block):block is Figure=>block.kind==='original-figure');
    })();
    requests.set(id,request);
    if(requests.size>16) requests.delete(requests.keys().next().value!);
    request.catch(()=>{if(requests.get(id)===request) requests.delete(id);});
  }
  const matches=(await request).filter(block=>captionKey(block.caption)===captionKey(caption));
  return matches.length===1 ? matches[0] : undefined;
}

export async function recoverOriginalImages(url:string, caption:string, fetcher:typeof fetch=fetch):Promise<string[]> {
  return (await recoverOriginalFigure(url,caption,fetcher))?.imageUrls??[];
}
