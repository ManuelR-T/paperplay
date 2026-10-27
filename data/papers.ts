import { numericPaper } from './numeric-paper';
import paperSelections from './papers.json';
import { validateDocument, type SourceDocument } from '../shared/schema';

export type PreparedPaper = {
  id: string;
  document: SourceDocument;
  sourceUrl: string;
  pdfUrl: string;
  attribution: {
    authors: string;
    venue: string;
    license: string;
    licenseUrl: string;
    notice: string;
  };
  coverage: string;
  illustrationAnchors: { primary: string; comparison: string; walkthrough: string };
};

/** Licensed source selections, not generated explanations or automatically imported documents. */
export const preparedPapers: PreparedPaper[] = [...paperSelections.map(paper => ({
  ...paper,
  document: validateDocument(paper.document),
})), numericPaper];

export function getPreparedPaper(id: string): PreparedPaper | undefined {
  return preparedPapers.find(paper => paper.id === id);
}
