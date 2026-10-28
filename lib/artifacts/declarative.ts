import type { RepresentationPlan } from '../../shared/representations';
import type { FigureArtifact } from '../../shared/figure-artifacts';
import { validateFigureArtifact } from '../../shared/figure-artifacts';
import type { SourceDocument } from '../../shared/schema';
/** Existing representation semantics are kept intact; this does not rewrite v2 widgets. */
export function declarativeFigureArtifact(plan:RepresentationPlan,source:SourceDocument):Extract<FigureArtifact,{kind:'declarative'}>{return validateFigureArtifact({format:'paperplay-figure-artifact',schemaVersion:1,id:plan.id,title:plan.title,source:plan.source,authorship:plan.authorship,anchors:plan.anchors,assumptions:plan.assumptions,kind:'declarative',rights:'Original source and asset-specific rights remain applicable; this wrapper grants no additional redistribution rights.',representation:plan},source) as Extract<FigureArtifact,{kind:'declarative'}>;}
