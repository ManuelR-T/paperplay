import { z } from 'zod';
import { name, text } from './widget-primitives';

/** Declarations are portable data. A declaration never grants scientific verification. */
export const evidenceDeclarationSchema=z.strictObject({
  id:name,subject:z.strictObject({kind:z.enum(['claim','asset','quantity','view']),id:name}),
  origin:z.enum(['user-supplied','source-quotation','authored-assumption','source-extracted','observed-data','computed-output','independent-reference']),
  anchorIds:z.array(name).max(32),assumptions:z.array(text.max(500)).max(16),
  references:z.array(z.strictObject({label:text.max(300),location:text.max(1000)})).max(16),
  dependsOn:z.array(name).max(32),
});
export type EvidenceDeclaration=z.infer<typeof evidenceDeclarationSchema>;

export const reportedScientificCheckSchema=z.strictObject({checkId:name,subject:z.strictObject({kind:z.enum(['claim','asset','quantity','view']),id:name}),binding:z.string().regex(/^[a-f0-9]{64}$/),level:z.enum(['mechanism-reproduction','experiment-reproduction']),reference:text.max(1000),scope:text.max(1000),passed:z.boolean(),details:text.max(2000)});
