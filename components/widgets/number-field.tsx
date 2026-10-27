'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { parseNumericDraft } from '@/lib/widgets/interaction';

export function NumberField({ label, value, min = -1_000_000, max = 1_000_000, step = 0.1, onChange, onSelect, hideLabel = false, style, integer = false }: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (value: number) => void; onSelect?: () => void; hideLabel?: boolean; style?: CSSProperties; integer?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [touched, setTouched] = useState(false);
  const sent = useRef(value); const id = useId();
  useEffect(() => { if (value !== sent.current) { setDraft(String(value)); sent.current = value; setTouched(false); } }, [value]);
  const parsed = parseNumericDraft(draft, min, max, integer);
  const error = parsed.kind === 'invalid' ? parsed.message : parsed.kind === 'incomplete' && touched ? 'Enter a number to apply this value.' : '';
  function change(text: string) {
    setDraft(text); setTouched(false);
    const next = parseNumericDraft(text, min, max, integer);
    if (next.kind === 'valid' && next.value !== value) { sent.current = next.value; onChange(next.value); }
  }
  return <label className={`widget-number-field ${hideLabel ? 'widget-number-compact' : ''}`}>
    {!hideLabel&&<span>{label}</span>}
    <input style={style} type="text" role="spinbutton" inputMode="decimal" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} value={draft} onFocus={onSelect} onChange={event => change(event.target.value)}
      onBlur={() => setTouched(true)} onKeyDown={event => {
        if (event.key === 'Escape') { setDraft(String(value)); setTouched(false); }
        if (event.key === 'Enter') { event.preventDefault(); setTouched(true); }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const base = parsed.kind === 'valid' ? parsed.value : value; change(String(Number(Math.min(max, Math.max(min, base + (event.key === 'ArrowUp' ? step : -step))).toPrecision(12)))); }
      }}/>
    {error && <span id={`${id}-error`} className="widget-field-error">{error} Escape restores {value}.</span>}
  </label>;
}
