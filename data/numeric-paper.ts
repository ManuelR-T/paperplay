import { validateDocument, type SourceDocument } from '../shared/schema';
import type { PreparedPaper } from './papers';

const url = 'https://distill.pub/2017/momentum/';
const document: SourceDocument = validateDocument({
  schemaVersion: 1, id: 'quadratic-optimization', sourceVersion: 'distill.00006-selected-2017-04-04-v1',
  title: 'Why Momentum Really Works', authors: ['Gabriel Goh'], source: { kind: 'prepared', url }, pageCount: 1,
  blocks: [
    { id: 'q-model', kind: 'heading', page: 1, level: 2, text: 'First Steps: Gradient Descent' },
    { id: 'q-context', kind: 'paragraph', page: 1, text: 'One nice model is the convex quadratic.' },
    { id: 'q-objective', kind: 'equation', page: 1, latex: 'f(w)=\\tfrac{1}{2}w^{T}Aw-b^{T}w,\\qquad w\\in\\mathbb{R}^{n}' },
    { id: 'q-gradient', kind: 'equation', page: 1, latex: 'w^{k+1}=w^{k}-\\alpha(Aw^{k}-b)' },
    { id: 'q-rate', kind: 'equation', page: 1, latex: 'x_i^{k+1}=(1-\\alpha\\lambda_i)^{k+1}x_i^0' },
    { id: 'q-stability', kind: 'equation', page: 1, latex: '0<\\alpha\\lambda_i<2' },
    { id: 'q-momentum', kind: 'heading', page: 1, level: 2, text: 'The Dynamics of Momentum' },
    { id: 'q-recurrence', kind: 'equation', page: 1, latex: 'z^{k+1}=\\beta z^k+(Aw^k-b),\\qquad w^{k+1}=w^k-\\alpha z^{k+1}' },
  ],
  anchors: [
    { id: 'quadratic-optimization-primary', blockId: 'q-objective', page: 1, quote: 'f(w)=\\tfrac{1}{2}w^{T}Aw-b^{T}w' },
    { id: 'quadratic-optimization-comparison', blockId: 'q-recurrence', page: 1, quote: 'z^{k+1}=\\beta z^k+(Aw^k-b)' },
    { id: 'quadratic-optimization-walkthrough', blockId: 'q-rate', page: 1, quote: 'x_i^{k+1}=(1-\\alpha\\lambda_i)^{k+1}x_i^0' },
  ],
  extractionWarnings: ['This is a selected HTML reading edition, not a PDF transcription. Reference 1 is a logical HTML source location, not a physical PDF page.', 'Only selected original equations and one short original sentence are included. Source images, reused third-party figures, proofs and original experiments are omitted.'],
});
export const numericPaper: PreparedPaper = {
  id: 'quadratic-optimization', document, sourceUrl: url, pdfUrl: url,
  attribution: { authors: 'Gabriel Goh', venue: 'Distill · 2017 · DOI 10.23915/distill.00006', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', notice: 'Selected original text and equations from Gabriel Goh, “Why Momentum Really Works”, Distill (2017), DOI 10.23915/distill.00006. The publisher licenses original text/diagrams CC BY 2.0; third-party reused figures are excluded and are not bundled. Paperplay adds independent TypeScript simulations using synthetic matrices.' },
  coverage: 'Selected original equations and a short sentence from the HTML sections on gradient descent and momentum. The original article remains available online. All source references are logical HTML locations.',
  illustrationAnchors: { primary: 'quadratic-optimization-primary', comparison: 'quadratic-optimization-comparison', walkthrough: 'quadratic-optimization-walkthrough' },
};
