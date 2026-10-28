'use client';
import './widgets/widgets.css';
import { useState } from 'react';
import type { SourceDocument } from '@/shared/schema';
import { MAX_ASSET_FILE_BYTES, type ScientificAsset } from '@/shared/scientific-assets';
import { originalFigureAssets } from '@/lib/assets/local';
import { importScientificData } from '@/lib/assets/import';
import { Button } from './ui/button';

export function ScientificAssetImporter({source,target,onConfirm}:{source:SourceDocument;target?:{id:string;kind:string};onConfirm:(asset:ScientificAsset)=>void}) {
  const [originals,setOriginals]=useState<ScientificAsset[]>([]);
  const [preview,setPreview]=useState<ScientificAsset|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <section aria-label="Import scientific data" style={{minWidth:0,maxWidth:"100%"}}><h3>Import scientific data</h3><p className="reader-hint">CSV or JSON · up to 2 MiB, 1,000 table rows and 32 columns. Data stays in this browser. Inspect it before binding.</p>
    <label className="reader-field">Data file<input type="file" accept=".csv,.json,text/csv,application/json" disabled={busy} onChange={async event=>{const input=event.target,file=input.files?.[0];input.value='';if(!file)return;setError('');setPreview(null);setBusy(true);try{if(file.size>MAX_ASSET_FILE_BYTES)throw Error('Choose data below 2 MiB.');const asset=await importScientificData(file.name,await file.text(),{id:target?.id,source});if(target&&asset.kind!==target.kind)throw Error(`This representation requires ${target.kind} data.`);setPreview(asset);}catch(problem){setError(problem instanceof Error?problem.message:'The data could not be read.');}finally{setBusy(false);}}}/></label>
    {(!target||target.kind==='image')&&source.blocks.some(block=>block.kind==='original-figure')&&<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{setOriginals(await originalFigureAssets(source));}catch(problem){setError(problem instanceof Error?problem.message:'Original figure references are unavailable.');}finally{setBusy(false);}}}>Inspect original figure references</Button>}
    {originals.map(asset=><section key={asset.id}><ScientificAssetView asset={asset}/><Button variant="outline" onClick={()=>{try{onConfirm(asset);setOriginals([]);}catch(problem){setError(problem instanceof Error?problem.message:'The figure reference could not be bound.');}}}>Use this figure reference</Button></section>)}
    {busy&&<p role="status">Checking local data…</p>}{error&&<p role="alert">{error}</p>}
    {preview&&<><ScientificAssetView asset={preview}/><Button onClick={()=>{try{onConfirm(preview);setPreview(null);}catch(problem){setError(problem instanceof Error?problem.message:'Data could not be bound.');}}}>Use these data</Button><Button variant="ghost" onClick={()=>setPreview(null)}>Discard data preview</Button></>}
  </section>;
}
export function ScientificAssetView({asset}:{asset:ScientificAsset}) {
  return <section aria-label="Scientific data preview" style={{minWidth:0,maxWidth:"100%"}}><h4>{asset.label}</h4><p>{asset.kind} · shape {asset.shape.length?asset.shape.join(' × '):'not known'} · {asset.provenance.origin.replaceAll('-',' ')} · not independently verified</p><p className="reader-hint">{asset.provenance.attribution} {asset.provenance.rights}</p><p className="reader-hint">{asset.coordinates.system} Missing values: {asset.missingValues==='null'?'shown as missing, never zero':'not allowed'}. Units are descriptive until checked by a compatible engine.</p>
    {asset.kind==='table'?<div className="widget-table-region" role="region" tabIndex={0} aria-label="Imported data table"><table><caption>First {Math.min(20,asset.data.rows.length)} of {asset.data.rows.length} rows</caption><thead><tr><th scope="col">Row</th>{asset.data.columns.map(column=><th scope="col" key={column.id}>{column.label} ({column.unit})</th>)}</tr></thead><tbody>{asset.data.rows.slice(0,20).map(row=><tr key={row.id}><th scope="row">{row.id}</th>{row.values.map((value,index)=><td key={index}>{value===null?'Missing':String(value)}</td>)}</tr>)}</tbody></table></div>:<><p>Metadata and bounded data preview. A specialized visual is a separate capability; image URLs are not fetched by this inspector.</p><pre style={{maxHeight:240,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(asset.data,null,2).slice(0,4000)}</pre></>}
    <details><summary>Integrity and transformations</summary><p className="reader-hint" style={{overflowWrap:'anywhere'}}>SHA-256 ({asset.checksum.scope}): {asset.checksum.value}</p>{asset.transformations.map((item,index)=><p key={index}>{item.name}: {item.description}</p>)}</details>
  </section>;
}
