import { z } from 'zod';
import { figureArtifactSchema } from './figure-artifacts';
import { compiledFigureSchema } from './figure-compilation';
import { sdkEventSchema,sdkFrameSchema } from './figure-sdk';
export const runtimeRequestSchema=z.strictObject({format:z.literal('paperplay-runtime-request'),schemaVersion:z.literal(1),instanceId:z.string().uuid(),sequence:z.literal(1),artifact:figureArtifactSchema,compiled:compiledFigureSchema,compiledSha256:z.string().regex(/^[a-f0-9]{64}$/),input:z.unknown(),state:z.unknown(),event:sdkEventSchema});
export const runtimeResponseSchema=z.discriminatedUnion('status',[
 z.strictObject({format:z.literal('paperplay-runtime-response'),schemaVersion:z.literal(1),instanceId:z.string().uuid(),sequence:z.literal(1),status:z.literal('ready'),frame:sdkFrameSchema}),
 z.strictObject({format:z.literal('paperplay-runtime-response'),schemaVersion:z.literal(1),instanceId:z.string().uuid(),sequence:z.literal(1),status:z.literal('failed'),code:z.enum(['integrity','resource','invalid-input','invalid-output','execution','unavailable'])}),
]);
export { assertBoundedFigureJson } from './figure-json';
export type FigureRuntimeErrorCode='integrity'|'resource'|'invalid-input'|'invalid-output'|'execution'|'unavailable';
const runtimeMessages:Record<FigureRuntimeErrorCode,string>={unavailable:'The checked execution infrastructure is unavailable. The source remains readable.',integrity:'The figure changed or its execution response did not match.',resource:'The figure exceeded its resource limit. Stop another figure or try a smaller input.', 'invalid-input':'The supplied figure inputs do not match its declared interface.', 'invalid-output':'The generated output failed drawing, source-link or value-format checks.',execution:'The generated code failed or exceeded its execution limit.'};
export class FigureRuntimeError extends Error{constructor(readonly code:FigureRuntimeErrorCode){super(runtimeMessages[code]);this.name='FigureRuntimeError';}}
