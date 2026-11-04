import { z } from 'zod';
export const FIGURE_QUALITY_POLICY=Object.freeze({version:'figure-quality-v2',maxFrames:12,maxDurationMs:30000,maxDiagnostics:32,viewBoxPadding:24});
export const figureQualityCodeSchema=z.enum(['blank-scene','text-clipped','text-overlap','legend-overlap','unreachable-control','invalid-input','invalid-output','execution','page-overflow','small-target','keyboard-unreachable','low-contrast','missing-host-controls','unexpected-motion','missing-text-measurement','console-error','integrity','infrastructure','deadline','cancelled']);
export const figureQualityViewportSchema=z.strictObject({width:z.number().int().min(240).max(4096),height:z.number().int().min(240).max(4096),textScale:z.union([z.literal(1),z.literal(2)]),reducedMotion:z.boolean().optional()});
export const figureQualityDiagnosticSchema=z.strictObject({code:figureQualityCodeSchema,scope:z.enum(['artifact','host']),step:z.number().int().min(0).max(11),markIndex:z.number().int().min(0).max(511).optional(),controlIndex:z.number().int().min(0).max(15).optional(),viewport:figureQualityViewportSchema.optional()});
export const figureQualityFeedbackSchema=z.strictObject({status:z.enum(['not-run','passed','failed','cancelled','unavailable']),diagnostics:z.array(figureQualityDiagnosticSchema).max(32),framesChecked:z.number().int().min(0).max(12),textMeasurements:z.enum(['not-run','provided'])});
export type FigureQualityCode=z.infer<typeof figureQualityCodeSchema>;
export type FigureQualityViewport=z.infer<typeof figureQualityViewportSchema>;
export type FigureQualityDiagnostic=z.infer<typeof figureQualityDiagnosticSchema>;
export type FigureQualityFeedback=z.infer<typeof figureQualityFeedbackSchema>;
/** Bounds supplied by trusted host measurement in the SVG coordinate system, never by artifact JSON. */
export type FigureTextBounds={markIndex:number;x:number;y:number;width:number;height:number};
export type FigureQualityStepId='initialize'|'slider-min'|'slider-max'|'button'|'entity'|'sequential';
