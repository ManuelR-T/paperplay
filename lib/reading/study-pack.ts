import { validateDocument, validateSnapshot, type ExperimentSnapshot, type SourceDocument } from '../../shared/schema';
import { engineRegistry } from '../engines';
import { preparedPapers } from '../../data/papers';
import { bundleAttributionSchema, encodePublicSnapshot, type BundleAttribution } from '../snapshots';
import { encodeWidgetSnapshot } from '../widgets/compatibility';
import { validateWidgetEnvelope, type WidgetEnvelope } from '../../shared/widgets';
import { sourceText, type PersonalNote } from './personal';

export type CapturedFigure = { title: string; text: string; svg: string[]; snapshot?: ExperimentSnapshot; widgetSnapshot?: WidgetEnvelope };
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
export function createStudyPack(options: { source: SourceDocument; figures: CapturedFigure[]; includeSource: boolean; notes?: PersonalNote[]; attribution?: BundleAttribution; appOrigin?: string; original?: { name: string; base64: string } }) {
  const source = validateDocument(options.source);
  const attribution = options.attribution ? bundleAttributionSchema.parse(options.attribution) : undefined;
  const appOrigin = options.appOrigin ? new URL(options.appOrigin).origin : undefined;
  if (appOrigin && !/^https?:\/\//.test(appOrigin)) throw Error('A reopen link requires an HTTP(S) Paperplay origin.'); if (options.figures.length > 64) throw Error('Export at most 64 figures in one study pack.');
  const figures = options.figures.map(figure => {
    if (figure.text.length > 60_000 || figure.svg.join('').length > 1_000_000) throw Error('A figure exceeds the study-pack export limit.');
    const snapshot = figure.snapshot ? validateSnapshot(figure.snapshot, source, engineRegistry) : undefined;
    const widgetSnapshot = figure.widgetSnapshot ? validateWidgetEnvelope(figure.widgetSnapshot,source) : undefined;
    return { ...figure, snapshot, widgetSnapshot };
  });
  if (options.original && (!options.includeSource || options.original.base64.length > 14_000_000 || !/^[A-Za-z0-9+/=]+$/.test(options.original.base64))) throw Error('Including an original PDF requires source inclusion and a bounded PDF payload.');
  const edition = preparedPapers.find(item => item.document.id === source.id && item.document.sourceVersion === source.sourceVersion);
  const supplied = attribution ? `<p>Supplied source attribution: ${escapeHtml(attribution.notice)}</p><p>${escapeHtml(attribution.authors)}${attribution.license?' · '+escapeHtml(attribution.license):''}${attribution.licenseUrl?' · <a href="'+escapeHtml(attribution.licenseUrl)+'">License reference</a>':''}</p>` : '';
  const notice = edition ? `<p>${escapeHtml(edition.attribution.notice)}</p><p>${escapeHtml(edition.attribution.authors)} · ${escapeHtml(edition.attribution.venue)} · <a href="${escapeHtml(edition.attribution.licenseUrl)}">${escapeHtml(edition.attribution.license)}</a></p>` : supplied + '<p>Supplied attribution is retained; Paperplay has not independently verified redistribution rights for an imported source.</p>';
  const attr = `<p>${escapeHtml(source.authors.join(' · '))}</p>${source.source.url ? `<p><a href="${escapeHtml(source.source.url)}">Original source record</a></p>` : ''}<p>Source identity: ${escapeHtml(source.id)} · ${escapeHtml(source.sourceVersion)}. Rights remain with the source authors; importing a document does not establish permission to redistribute it.</p>`;
  const passages = options.includeSource ? source.blocks.map(block => block.kind === 'heading' ? `<h2>${escapeHtml(block.text)}</h2>` : `<section id="source-${escapeHtml(source.id)}-${escapeHtml(block.id)}"><p class="reference">Source reference ${block.page} · ${escapeHtml(block.id)}</p>${block.kind === 'equation' ? `<pre>${escapeHtml(block.latex)}</pre>` : `<p>${escapeHtml(sourceText(block))}</p>`}</section>`).join('') : '<p>Original source text is not included. Consult the cited source separately.</p>';
  const reopen = (figure: typeof figures[number]) => { if (!appOrigin) return ''; let hash = ''; try { hash = figure.widgetSnapshot ? `widget=${encodeWidgetSnapshot(figure.widgetSnapshot)}` : figure.snapshot ? `snapshot=${encodePublicSnapshot(figure.snapshot)}` : ''; } catch { /* A private legacy source needs an explicit source/experiment bundle rather than a public URL. */ } return hash ? `<p><a href="${escapeHtml(appOrigin+'/#'+hash)}">Reopen this experiment at the originating Paperplay installation</a></p><p class="reference">Requires compatible source/version and site access. This link does not transfer a local PDF.</p>` : '<p class="reference">No portable URL is available for this figure. Exact parameters remain below; transfer its explicit experiment bundle to reopen it.</p>'; };
  const visual = figures.map((figure,index) => `<section class="captured-figure"><h2>${escapeHtml(figure.title)}</h2><p class="reference">Captured visible state ${index + 1}; static image/text, not an automatically recomputed experiment. Current playback and complete-run totals retain their displayed labels.</p>${reopen(figure)}${figure.svg.map((image,index)=>`<img class="captured-svg" alt="${escapeHtml(figure.title)} — captured visual ${index+1}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(image)}">`).join('')}<pre class="figure-values">${escapeHtml(figure.text)}</pre>${figure.snapshot ? `<details><summary>Exact versioned input and parameters</summary><pre>${escapeHtml(JSON.stringify(figure.snapshot,null,2))}</pre></details>` : ''}${figure.widgetSnapshot ? `<details><summary>Exact versioned widget data and controls</summary><pre>${escapeHtml(JSON.stringify(figure.widgetSnapshot,null,2))}</pre></details>` : ''}</section>`).join('');
  const notes = options.notes?.length ? `<h2>Personal notes and selected quotations</h2>${options.notes.map(note=>`<article><p class="reference">${escapeHtml(note.kind)} · ${escapeHtml(note.blockId)} · ${escapeHtml(note.sourceVersion)}</p><blockquote>${escapeHtml(note.quote)}</blockquote><p>${escapeHtml(note.text)}</p><p>${escapeHtml(note.tags.join(', '))}</p></article>`).join('')}` : '';
  const pdf = options.original ? `<p><a download="${escapeHtml(options.original.name)}" href="data:application/pdf;base64,${options.original.base64}">Explicitly included original PDF</a></p>` : '';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(source.title)} — Paperplay study pack</title><style>body{font:20px/1.75 Georgia,serif;color:#202a22;background:#fff;max-width:72ch;margin:auto;padding:32px}h1,h2{line-height:1.25}a{color:#294a1a}p,blockquote,pre{overflow-wrap:anywhere}.reference{font:14px/1.6 Arial,sans-serif;color:#43513b}pre{white-space:pre-wrap;font-size:15px}svg,.captured-svg{display:block;max-width:100%;height:auto;max-height:500px}.captured-figure{border-top:1px solid #aebba3;padding-top:22px;margin-top:32px;break-inside:avoid}blockquote{border-left:3px solid #869f61;padding-left:18px;margin-left:0}@media print{body{font-size:12pt;padding:0;max-width:none}h1,h2{break-after:avoid}pre{font-size:9pt}a{color:inherit}.captured-figure{break-inside:avoid}}</style><h1>${escapeHtml(source.title)}</h1>${attr}${notice}<p>Paperplay study pack · captured ${new Date().toISOString()}. Added explanations and synthetic results are separate from the original authors’ claims. No original experiment reproduction is established by an export.</p>${pdf}${passages}<h2>Captured experiments</h2>${visual||'<p>No mounted experiment was captured. Open the desired figures before exporting.</p>'}${notes}</html>`;
  if (new TextEncoder().encode(html).length > 20_000_000) throw Error('This study pack exceeds 20 MB. Export fewer figures or omit the PDF.'); return html;
}

/** Capture only trusted SVG shapes. No links, handlers, images, HTML or external resources survive. */
export function captureFigureSvg(svg: SVGElement): string {
  const tags = new Set(['svg','g','path','text','tspan','line','polyline','polygon','circle','ellipse','rect','defs','marker','clippath','lineargradient','stop','title','desc']);
  const attributes = new Set(['xmlns','viewbox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-dasharray','opacity','fill-opacity','stroke-opacity','transform','font-size','font-family','font-weight','text-anchor','dominant-baseline','id','marker-end','marker-start','markerwidth','markerheight','refx','refy','orient','offset','stop-color','stop-opacity','clip-path','role','aria-label']);
  const clone = svg.cloneNode(true) as SVGElement;
  for (const element of [clone,...clone.querySelectorAll('*')]) {
    if (!tags.has(element.tagName.toLowerCase())) { element.remove(); continue; }
    for (const attr of [...element.attributes]) if (!attributes.has(attr.name.toLowerCase()) || /(?:javascript:|https?:|data:|expression\s*\()/i.test(attr.value) || /url\(/i.test(attr.value) && !/^url\(#[A-Za-z0-9_.:-]+\)$/.test(attr.value)) element.removeAttribute(attr.name);
  }
  return clone.outerHTML;
}
