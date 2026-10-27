'use client';
import { useEffect, useRef, useState } from 'react';
import type { SourceDocument } from '@/shared/schema';
import type { OriginalFigureCrop } from '@/lib/reading/original-figures';
import { Button } from '../ui/button';

type PdfTask = ReturnType<typeof import('pdfjs-dist')['getDocument']>;
/** Render original PDF pixels, not a generated reconstruction or a browser plugin. */
export function OriginalPdfPage({ source, blockId, original, url, inlineFigure = false, crop }: { source: SourceDocument; blockId: string; original?: Blob; url?: string; inlineFigure?: boolean; crop?: OriginalFigureCrop }) {
  const block=source.blocks.find(item=>item.id===blockId)??source.blocks[0];
  const canvas=useRef<HTMLCanvasElement>(null);const holder=useRef<HTMLDivElement>(null);
  const [renderWidth,setRenderWidth]=useState(0);
  useEffect(()=>{const element=holder.current;if(!element)return;const measure=()=>setRenderWidth(Math.floor(element.clientWidth));measure();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
  const [wholePage,setWholePage]=useState(false);const activeCrop=wholePage?undefined:crop;
  const [status,setStatus]=useState('Loading the original PDF page locally…');const [error,setError]=useState('');const [zoom,setZoom]=useState(1);const [showRegions,setShowRegions]=useState(false);
  const [boxes,setBoxes]=useState<{x:number;y:number;width:number;height:number;text:string}[]>([]);const [dimensions,setDimensions]=useState({width:1,height:1});
  const mapping=source.reconstruction?.pages.find(page=>page.page===block.page);
  const canLocate=Boolean(mapping?.coordinatesComplete&&mapping.height&&block.reconstruction?.regionIds.length&&block.reconstruction.regionIds.every(id=>mapping.regions.some(region=>region.id===id)));
  useEffect(()=>{
    if(!renderWidth)return;
    let disposed=false;let task:PdfTask|undefined;let rendering:{cancel:()=>void}|undefined;const controller=new AbortController();setError('');setStatus('Loading the original PDF page locally…');setBoxes([]);
    void(async()=>{try{
      let blob=original;if(!blob){if(!url)throw Error('The original PDF is not stored on this device.');const target=new URL(url,location.href);if(target.origin!==location.origin)throw Error('Use the original link to view this external PDF. No cross-origin PDF was fetched into the reader.');const response=await fetch(target.href,{signal:controller.signal});if(!response.ok)throw Error('The original PDF could not be loaded.');blob=await response.blob();}
      if(blob.size>10*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw Error('The original file is not a supported PDF up to 10 MiB.');
      const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';if(disposed)return;
      task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/',useSystemFonts:true});
      const pdf=await task.promise;if(disposed)return;if(block.page>pdf.numPages)throw Error('The source reference exceeds the original PDF page count.');const page=await pdf.getPage(block.page);if(disposed)return;
      const natural=page.getViewport({scale:1});const width=Math.min(1050,Math.max(230,renderWidth-2));const scale=width/(natural.width*(activeCrop?.width??1))*zoom;const viewport=page.getViewport({scale});const offsetX=(activeCrop?.x??0)*viewport.width,offsetY=(activeCrop?.y??0)*viewport.height;const shownWidth=viewport.width*(activeCrop?.width??1),shownHeight=viewport.height*(activeCrop?.height??1);const density=Math.min(2,window.devicePixelRatio||1);if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||shownWidth>2500||shownHeight>6000||shownWidth*shownHeight*density*density>16_000_000)throw Error('This page exceeds the bounded original-preview size. Use the original-page link or a smaller page zoom.');
      const target=canvas.current;if(!target)return;const context=target.getContext('2d');if(!context)throw Error('The browser could not create the PDF page canvas.');target.width=Math.ceil(shownWidth*density);target.height=Math.ceil(shownHeight*density);target.style.width=`${shownWidth}px`;target.style.height=`${shownHeight}px`;setDimensions({width:shownWidth,height:shownHeight});
      const render=page.render({canvas:target,canvasContext:context,viewport,transform:[density,0,0,density,-offsetX*density,-offsetY*density]});rendering=render;await render.promise;if(disposed)return;
      if(canLocate&&mapping){setBoxes(mapping.regions.filter(region=>block.reconstruction!.regionIds.includes(region.id)).map(region=>{const [x1,y1]=viewport.convertToViewportPoint(region.x,region.y);const [x2,y2]=viewport.convertToViewportPoint(region.x+region.width,region.y+region.height);return {x:Math.min(x1,x2)-offsetX,y:Math.min(y1,y2)-offsetY,width:Math.abs(x2-x1),height:Math.abs(y2-y1),text:region.text};}));}
      setStatus(`Original PDF · page ${block.page} of ${pdf.numPages}. Rendered from the original bytes; no model request.`);
      // Retain original canvas pixels, release the full PDF/worker immediately.
      const completedTask=task;task=undefined;rendering=undefined;await completedTask.destroy().catch(()=>{});
    }catch(caught){if(!disposed){setError(caught instanceof Error?caught.message:'The original page could not be rendered.');setStatus('Original page preview unavailable; use the original link below.');}}})();
    return()=>{disposed=true;controller.abort();rendering?.cancel();void task?.destroy().catch(()=>{});};
  },[original,url,blockId,block.page,zoom,source.sourceVersion,activeCrop,renderWidth]);
  const pageTools=<div className="reader-choice">{crop&&<Button variant="outline" onClick={()=>{setWholePage(value=>!value);setZoom(1);}}>{wholePage?'Show figure crop':'Show whole page'}</Button>}<Button variant="outline" onClick={()=>setZoom(value=>Math.max(.75,value-.25))} disabled={zoom<=.75}>Zoom out</Button><Button variant="outline" onClick={()=>setZoom(1)}>Fit</Button><Button variant="outline" onClick={()=>setZoom(value=>Math.min(inlineFigure?3:1.5,value+.25))} disabled={zoom>=(inlineFigure?3:1.5)}>Zoom in</Button>{canLocate&&<label><input type="checkbox" checked={showRegions} onChange={event=>setShowRegions(event.target.checked)}/> Show extracted text regions</label>}</div>;
  const preview=<div ref={holder} className="original-page-scroll" tabIndex={0} role="region" aria-label="Original PDF page preview; use arrow or page keys to scroll"><div className="original-page-canvas" style={{width:dimensions.width,height:dimensions.height}}><canvas ref={canvas} aria-label={`Original PDF page ${block.page}; source quotation or caption is displayed alongside`}/>{showRegions&&canLocate&&<svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} role="img" aria-label="Available source-extraction text region positions; glyph extents are approximate">{boxes.map((box,index)=><rect key={index} x={box.x} y={box.y} width={Math.max(1,box.width)} height={Math.max(1,box.height)} fill="#d6e644" fillOpacity=".3" stroke="#718300" strokeWidth="1"><title>{box.text}</title></rect>)}</svg>}</div></div>;
  const geometryNote=<p className="reader-hint">{canLocate?'Optional highlights use retained extraction coordinates; glyph extents may be approximate. The original page pixels are unchanged.':'Page and quoted passage only. No coordinate highlight is inferred when a reliable mapping is absent.'}</p>;
  return <div className="original-page-view">
    {pageTools}
    {error&&<p role="alert">{error}</p>}
    <p role="status" className="reader-hint">{inlineFigure&&status.startsWith('Original PDF')?`Original PDF · page ${block.page}${activeCrop?' · reviewed figure region':' · complete page'}`:status}</p>
    {preview}
    {(!inlineFigure||showRegions)&&geometryNote}
  </div>;
}
