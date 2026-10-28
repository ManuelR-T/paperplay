import type { ExtractionEvidenceManifest } from './extraction-evidence';
import type { FigureSpecification, SourceDocument } from './schema';

export const ANALYSIS_PIPELINE_VERSION = 'm2-v1' as const;
export type ImportStage = 'extracting' | 'preparing' | 'ready' | 'submitting' | 'queued' | 'analyzing' | 'validating' | 'complete' | 'cancelled' | 'failed' | 'uncertain' | 'expired';
export type ImportedSource = { source: SourceDocument; original?: Blob; originalName?: string; originalUrl?: string; extractionEvidence?:ExtractionEvidenceManifest; extractionEvidenceRecovery?:{original:unknown;reason:string} };
export type AnalysisJob = {
  token: string; model: string; sourceId: string; sourceVersion: string; createdAt: number;
};
export type GeneratedFigure = { figure: FigureSpecification; explanation: string; sourceQuote: string; sourcePage: number };
export type AnalysisResult = {
  pipelineVersion: typeof ANALYSIS_PIPELINE_VERSION;
  document: SourceDocument; summary: string; figures: GeneratedFigure[]; warnings: string[]; model: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};
export type ImportRecord = ImportedSource & {
  id: string; stage: ImportStage; updatedAt: number; pipelineVersion: typeof ANALYSIS_PIPELINE_VERSION;
  attribution?: { authors: string; notice: string; sourceUrl?: string; license?: string; licenseUrl?: string };
  requestId?: string; job?: AnalysisJob; analysis?: AnalysisResult; error?: string;
};
export type AnalysisReply = {
  status: 'queued' | 'analyzing' | 'complete' | 'cancelled' | 'failed' | 'expired' | 'incomplete';
  job?: AnalysisJob; result?: AnalysisResult; error?: string;
};
