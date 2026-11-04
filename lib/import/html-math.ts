import type * as cheerio from 'cheerio';
import { cleanText } from './normalize';

type Api = cheerio.CheerioAPI;
type Element = Parameters<Api>[0];

/** The TeX source LaTeXML attaches to a MathML element. */
export function texOf($: Api, element: Element) {
  const node = $(element);
  return node.attr('alttext') || node.find('annotation[encoding="application/x-tex"]').first().text();
}

/**
 * Readable text where each formula appears once, as `\(TeX\)`.
 * A MathML element's raw text holds both its rendered glyphs and its TeX annotation,
 * so `.text()` alone duplicates every formula ("|Φ⟩BA\ket{\Phi}_{B_A}").
 */
export function textWithTex($: Api, element: Element | ReturnType<Api>) {
  const node = $(element as Element).first().clone();
  node.find('math').each((_, math) => { const tex = texOf($, math).trim(); $(math).replaceWith($('<span>').text(tex ? `\\(${tex}\\)` : $(math).text())); });
  return cleanText(node.text());
}
