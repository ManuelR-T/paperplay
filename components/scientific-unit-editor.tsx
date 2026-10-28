'use client';
import { useState } from 'react';
import { UNIT_IDS, scientificUnits, type UnitId } from '@/shared/scientific-quantities';
import type { ScientificAsset } from '@/shared/scientific-assets';
import type { SourceDocument } from '@/shared/schema';
import { changeTableUnit } from '@/lib/quantities/asset-units';
import { Button } from './ui/button';
export function ScientificUnitEditor({asset,source,onChange}:{asset:Extract<ScientificAsset,{kind:'table'}>;source:SourceDocument;onChange:(asset:ScientificAsset)=>void}) {
 const numeric=asset.data.columns.filter(column=>column.type==='number');const [columnId,setColumnId]=useState(numeric[0]?.id??''),[to,setTo]=useState<UnitId>('1'),[mode,setMode]=useState<''|'absolute'|'difference'>(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const column=asset.data.columns.find(column=>column.id===columnId);const temperature=scientificUnits[to].dimensions[4]===1;
 if(!numeric.length)return null;
 return <details><summary>Declare or convert column units</summary><p className="reader-hint">Declaring an unspecified unit leaves values unchanged. Converting an existing supported unit changes values. No source verification is implied.</p><div className="reader-choice"><label className="reader-field">Column<select value={columnId} onChange={event=>{setColumnId(event.target.value);setError('');}}>{numeric.map(column=><option key={column.id} value={column.id}>{column.label} ({column.unit})</option>)}</select></label><label className="reader-field">Target unit<select value={to} onChange={event=>{setTo(event.target.value as UnitId);setMode('');setError('');}}>{UNIT_IDS.map(id=><option key={id} value={id}>{scientificUnits[id].symbol}</option>)}</select></label>{temperature&&<label className="reader-field">Temperature meaning<select value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="">Choose explicitly</option><option value="absolute">Absolute temperature</option><option value="difference">Temperature difference</option></select></label>}</div>
 <Button variant="outline" disabled={busy||temperature&&!mode} onClick={async()=>{setBusy(true);setError('');try{onChange(await changeTableUnit(asset,columnId,to,temperature?mode||undefined:undefined,source));}catch(problem){setError(problem instanceof Error?problem.message:'Unit change failed.');}finally{setBusy(false);}}}>{column?.unit==='unspecified'?'Declare unit (values unchanged)':'Convert values'}</Button>{error&&<p role="alert">{error}</p>}</details>;
}
