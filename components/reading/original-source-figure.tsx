'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { recoverOriginalFigure } from '@/lib/reading/recover-original-images';
import { originalFigureCrop } from '@/lib/reading/original-figures';
import type { SourceDocument } from '@/shared/schema';
import { SourceMath } from './source-math';

const OriginalPdfPage = dynamic(() => import('./original-pdf-page').then(m => m.OriginalPdfPage), { ssr: false });
type Figure = Extract<SourceDocument['blocks'][number], { kind: 'original-figure' }>;

/** Original source pixels belong in the reading flow, independently of AI additions. */
export function OriginalSourceFigure({ source, block, original, url, htmlSource = false }: {
  source: SourceDocument; block: Figure; original?: Blob; url?: string; htmlSource?: boolean;
}) {
  const holder = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reservedHeight,setReservedHeight]=useState(220);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  useEffect(() => {
    if (!holder.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      const near=entries.some(entry=>entry.isIntersecting);
      if(!near){const height=holder.current?.querySelector('.original-page-view')?.getBoundingClientRect().height;if(height)setReservedHeight(height);}
      setVisible(near);
    }, { rootMargin: '400px' });
    observer.observe(holder.current); return () => observer.disconnect();
  }, []);
  const [recovered, setRecovered] = useState<Figure>();
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    setRecovered(undefined);
    if (!htmlSource || block.imageUrls?.length || block.inlineSvg || block.table || !url) return;
    let active = true;
    setRecovering(true);
    recoverOriginalFigure(url, block.caption).then(images => { if(active) setRecovered(images); })
      .catch(() => { /* The original article link remains available. */ })
      .finally(() => { if(active) setRecovering(false); });
    return () => { active = false; };
  }, [htmlSource, block.imageUrls, block.inlineSvg, block.table, block.caption, url]);
  const svg=block.inlineSvg??recovered?.inlineSvg;
  const images = svg ? ['data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)] : block.imageUrls?.length ? block.imageUrls : recovered?.imageUrls??[];
  const table = block.table ?? recovered?.table;
  return <figure ref={holder} className="original-source-figure source-block" id={`source-${source.id}-${block.id}`} tabIndex={-1}>
    <p className="original-source-label">Original {table || /^Table\s/i.test(block.caption) ? 'table' : 'illustration'} · {htmlSource ? 'source article' : `PDF page ${block.page}`} · authors’ content</p>
    {htmlSource ? table ? <div className="original-source-table-scroll" role="region" aria-label={block.caption} tabIndex={0}><table className="original-source-table"><tbody>{table.rows.map((row,i)=><tr key={i}>{row.cells.map((cell,j)=>{const Cell=cell.header?'th':'td';return <Cell key={j} rowSpan={cell.rowSpan} colSpan={cell.colSpan}><SourceMath text={cell.text}/></Cell>;})}</tr>)}</tbody></table></div> : images.length ? <div>{images.map(image => failedImages.includes(image)
      ? <p key={image} role="status">This original image could not be loaded. The caption and source link remain available.</p>
      // Original article assets are displayed as images, never executed as document markup.
      // eslint-disable-next-line @next/next/no-img-element
      : <img key={image} src={image} alt={block.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedImages(old => [...old, image])}/>)}</div>
      : <p role="status">{recovering ? 'Loading original source content…' : 'An inline preview is unavailable. Open the original article to view this source content.'}</p>
      : visible ? <OriginalPdfPage source={source} blockId={block.id} original={original} url={url} inlineFigure crop={originalFigureCrop(source,block.id)}/>
        : <div className="original-source-loading" style={{height:reservedHeight,minHeight:reservedHeight}} aria-label="Original illustration loads as it approaches the reading position">Original page preview loads here.</div>}
    <figcaption><SourceMath text={block.caption}/></figcaption>
    {url && <a href={htmlSource ? url : `${url}#page=${block.page}`} target="_blank" rel="noreferrer">Open complete original {htmlSource ? 'article' : `PDF at page ${block.page}`}</a>}
  </figure>;
}
