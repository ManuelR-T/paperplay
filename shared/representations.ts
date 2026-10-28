import { z } from 'zod';
import { dynamicsViewSchema,validateDynamicsRequest } from './dynamics';
import { reasoningGuideSchema,validateReasoningGuide } from './reasoning-guides';
import { spatialViewSchema,validateSpatialView } from './spatial-views';
import { statisticalChartSchema,validateStatisticalChart } from './statistical-charts';
import { representationNavigationSchema, selectionChannel } from './semantic-selections';
import { isRepresentationSelection, representationInputRevision } from './representation-selection';
import { composedSceneSchema, validateComposedScene } from './composed-scene';
import { capabilityReferenceSchema, representationInteractionSchema, viewCapability } from './representation-capabilities';
import { scientificQuantitySchema, quantityRequirementSchema, validateScientificQuantity } from './scientific-quantities';
import { scientificAssetSchema } from './scientific-assets';
import { evidenceDeclarationSchema, reportedScientificCheckSchema } from './research-evidence';
import { validateDocument, type SourceDocument } from './schema';
import { widgetEnvelopeSchema, validateWidgetEnvelope, type WidgetEnvelope } from './widgets';
import { name, text } from './widget-primitives';

export const REPRESENTATION_VERSION = 1 as const;
export const MAX_REPRESENTATION_BYTES = 256 * 1024;
export const representationAnchorSchema = z.strictObject({ id: name, blockId: z.string().min(1).max(100), page: z.number().int().min(1).max(500), quote: text.max(1000) });
export const evidenceLevelSchema = z.enum(['illustrative-walkthrough','simplified-illustration','mechanism-reproduction','experiment-reproduction']);
const ids = z.array(name).min(1).max(32);
export const representationViewSchema = z.discriminatedUnion('kind', [
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('dynamics'),dynamics:dynamicsViewSchema}),
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('reasoning-guide'),guide:reasoningGuideSchema}),
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('spatial-view'),spatial:spatialViewSchema}),
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('statistical-chart'),chart:statisticalChartSchema}),
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('composed-scene'),scene:composedSceneSchema}),
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('quantity'),quantityId:name,requirement:quantityRequirementSchema}),
  z.strictObject({id:name,adapter:capabilityReferenceSchema.optional(),kind:z.literal('asset'),assetId:name}),
  z.strictObject({ id: name, adapter:capabilityReferenceSchema.optional(), kind: z.literal('widget'), widget: widgetEnvelopeSchema }),
  z.strictObject({ id: name, adapter:capabilityReferenceSchema.optional(), kind: z.literal('source-guide'), steps: z.array(z.strictObject({ id: name, title: text.max(160), explanation: text, anchorIds: ids })).min(1).max(32) }),
]);
export const representationPlanSchema = z.strictObject({
  format: z.literal('paperplay-representation'), schemaVersion: z.literal(REPRESENTATION_VERSION), id: name, title: text.max(200),
  source: z.strictObject({ documentId: z.string().min(1).max(100), sourceVersion: z.string().min(1).max(100) }),
  authorship: z.strictObject({kind:z.enum(['user','meta','prepared','imported']),label:text.max(200)}),
  objective: text.max(1000), anchors: z.array(representationAnchorSchema).min(1).max(32),
  claims: z.array(z.strictObject({ id: name, kind: z.enum(['source','pedagogical-addition']), text, anchorIds: ids })).min(1).max(32),
  assumptions: z.array(text.max(500)).max(16), requestedEvidence: evidenceLevelSchema,
  assets: z.array(z.strictObject({ id: name, kind: z.enum(['table','tensor','image','sequence','graph','geometry']), description: text.max(500), checksum:z.string().regex(/^[a-f0-9]{64}$/).optional() })).max(32),
  quantities: z.array(z.strictObject({ id: name, symbol: text.max(80), unit: text.max(80), description: text.max(500), measurement:scientificQuantitySchema.optional() })).max(32),
  execution: z.strictObject({ kind: z.enum(['none','local-computation']), capabilities: z.array(capabilityReferenceSchema).min(1).max(16), assetIds: z.array(name).max(32) }),
  interactions: z.array(representationInteractionSchema).max(6),
  assetManifests:z.array(scientificAssetSchema).max(32).optional(),
  evidence: z.array(evidenceDeclarationSchema).max(128).optional(),
  reportedChecks: z.array(reportedScientificCheckSchema).max(64).optional(),
  navigation:representationNavigationSchema.optional(),
  views: z.array(representationViewSchema).min(1).max(8),
});
export type RepresentationPlan = z.infer<typeof representationPlanSchema>;
export type RepresentationAnchor = z.infer<typeof representationAnchorSchema>;

const normalized = (value: string) => value.replace(/\s+/g,' ').trim();
function unique(values: string[], label: string) { if(new Set(values).size !== values.length) throw Error(`Duplicate ${label}.`); }
export function validateRepresentationPlan(input: unknown, originalSource: SourceDocument): RepresentationPlan {
  if(new TextEncoder().encode(JSON.stringify(input)).length > MAX_REPRESENTATION_BYTES) throw Error('Representation exceeds its 256 KiB allowance.');
  const plan = representationPlanSchema.parse(input), source = validateDocument(originalSource);
  if(plan.source.documentId !== source.id || plan.source.sourceVersion !== source.sourceVersion) throw Error('This representation requires its exact source version.');
  for(const [values,label] of [[plan.anchors,'anchor'],[plan.claims,'claim'],[plan.views,'view'],[plan.assets,'asset'],[plan.quantities,'quantity'],[plan.execution.capabilities,'capability']] as const) unique(values.map(value=>value.id),label);
  unique(plan.interactions,'interaction'); unique(plan.execution.assetIds,'asset binding');
  const anchors = new Map(plan.anchors.map(anchor=>[anchor.id,anchor]));
  const checkAnchors = (refs: string[]) => { unique(refs,'anchor reference'); if(refs.some(id=>!anchors.has(id))) throw Error('A representation refers to an undeclared source anchor.'); };
  for(const anchor of plan.anchors) {
    const block=source.blocks.find(block=>block.id===anchor.blockId);
    const content=block?.kind==='equation'?block.latex:block?.kind==='original-figure'?block.caption:block?.text;
    if(!block || block.page !== anchor.page || !content || !normalized(content).includes(normalized(anchor.quote))) throw Error('A representation quote or page does not match the original source.');
  }
  for(const claim of plan.claims) {
    checkAnchors(claim.anchorIds);
    // A source claim is a quotation; interpretation belongs to the added layer.
    if(claim.kind==='source'&&!claim.anchorIds.some(id=>normalized(anchors.get(id)!.quote).includes(normalized(claim.text)))) throw Error('A source claim must quote its anchor; label interpretations as pedagogical additions.');
  }
  if(plan.execution.assetIds.some(id=>!plan.assets.some(asset=>asset.id===id))) throw Error('Execution requires an undeclared asset.');
  for(const view of plan.views) {
    const capability=viewCapability(view);
    if(!plan.execution.capabilities.some(item=>item.id===capability.id&&item.version===capability.version)) throw Error('A view requires its declared execution capability.');
    if(view.kind==='widget') {
      validateWidgetEnvelope(view.widget,source);
      if(!plan.anchors.some(anchor=>anchor.blockId===view.widget.source.blockId&&anchor.page===view.widget.source.page&&normalized(anchor.quote)===normalized(view.widget.source.quote))) throw Error('A widget must use an anchor declared in its representation.');
      if(plan.execution.kind!=='local-computation') throw Error('Widget views require local computation.');
    } else if(view.kind==='dynamics'){
      validateDynamicsRequest(view.dynamics.request);checkAnchors(view.dynamics.anchorIds);
      if(plan.execution.kind!=='local-computation')throw Error('Dynamics views require explicit local computation.');
    } else if(view.kind==='reasoning-guide'){
      validateReasoningGuide(view.guide,plan.anchors);
    } else if(view.kind==='spatial-view'){
      validateSpatialView(view.spatial,[...anchors.keys()]);
      const main=plan.assets.find(asset=>asset.id===view.spatial.input.assetId),kind=view.spatial.input.kind==='image'?'image':'tensor';
      if(!main||main.kind!==kind||!plan.execution.assetIds.includes(main.id))throw Error('Spatial inputs require their declared original image or field tensor.');
      for(const layer of view.spatial.overlays)if(layer.kind==='mask'&&(!plan.assets.some(asset=>asset.id===layer.assetId&&asset.kind==='tensor')||!plan.execution.assetIds.includes(layer.assetId)))throw Error('Spatial masks require declared bound tensor assets.');
    } else if(view.kind==='statistical-chart'){
      validateStatisticalChart(view.chart);checkAnchors(view.chart.anchorIds);
      if(plan.execution.kind!=='local-computation')throw Error('A statistical chart requires explicit local data processing.');
      for(const series of view.chart.series)if(!plan.execution.assetIds.includes(series.assetId)||!plan.assets.some(asset=>asset.id===series.assetId&&asset.kind==='table'))throw Error('Chart series require declared, bound table assets.');
    } else if(view.kind==='composed-scene'){
      validateComposedScene(view.scene,[...anchors.keys()]);
      for(const node of view.scene.nodes)if(node.kind==='annotation'&&node.role==='source'&&!node.anchorIds.some(id=>normalized(anchors.get(id)!.quote).includes(normalized(node.text))))throw Error('A source annotation must quote its source; label interpretations as added assumptions.');
    } else if(view.kind==='quantity'){if(!plan.quantities.some(quantity=>quantity.id===view.quantityId))throw Error('A quantity view requires a declared quantity.');}
    else if(view.kind==='asset'){if(!plan.execution.assetIds.includes(view.assetId)||!plan.assets.some(asset=>asset.id===view.assetId))throw Error('An asset view needs a declared required asset.');}
    else { unique(view.steps.map(step=>step.id),'guide step'); view.steps.forEach(step=>checkAnchors(step.anchorIds)); }
  }
  if(plan.interactions.includes('select-time')&&!plan.views.some(view=>view.kind==='dynamics'))throw Error('This representation has no physical-time controls.');
  if(plan.interactions.includes('select-region')&&!plan.views.some(view=>view.kind==='spatial-view'))throw Error('This representation has no spatial region controls.');
  if(plan.interactions.includes('select-entity')&&!plan.views.some(view=>view.kind==='widget'||view.kind==='statistical-chart'||view.kind==='composed-scene'&&!!view.scene.entities?.length))throw Error('This representation has no semantic entity targets.');
  if(plan.interactions.includes('inspect-data')&&!plan.views.some(view=>view.kind==='dynamics'||view.kind==='asset'||view.kind==='quantity'||view.kind==='statistical-chart'||view.kind==='spatial-view'))throw Error('This representation has no data inspector.');
  if(plan.assetManifests&&new Set(plan.assetManifests.map(asset=>asset.id)).size!==plan.assetManifests.length)throw Error('Duplicate embedded asset.');
  for(const asset of plan.assetManifests??[]){const ref=plan.assets.find(ref=>ref.id===asset.id&&ref.kind===asset.kind);if(!ref)throw Error('An embedded asset must match a declared reference.');if(ref.checksum&&ref.checksum!==asset.checksum.value)throw Error('Embedded data does not match the required checksum.');}
  if(plan.interactions.includes('widget-controls')&&!plan.views.some(view=>view.kind==='widget'||view.kind==='dynamics')) throw Error('This representation has no computation controls.');
  if(plan.interactions.includes('select-step')&&!plan.views.some(view=>view.kind==='source-guide'||view.kind==='reasoning-guide'||view.kind==='composed-scene'&&view.scene.nodes.some(node=>node.kind==='scene'&&node.frames.length>0||node.kind==='process'&&node.steps.length>0))) throw Error('This representation has no source-guide steps.');
  for(const quantity of plan.quantities)if(quantity.measurement){const measurement=validateScientificQuantity(quantity.measurement);if(measurement.id!==quantity.id||measurement.unit!==quantity.unit)throw Error('A quantity measurement must retain its declared identity and original unit.');}
  const evidence=new Map((plan.evidence??[]).map(item=>[item.id,item]));
  unique((plan.evidence??[]).map(item=>item.id),'evidence record');
  const visited=new Set<string>(),visiting=new Set<string>();
  function visitEvidence(id:string){if(visiting.has(id))throw Error('Evidence dependencies contain a cycle.');if(visited.has(id))return;const item=evidence.get(id);if(!item)throw Error('An evidence dependency is missing.');visiting.add(id);item.dependsOn.forEach(visitEvidence);visiting.delete(id);visited.add(id);}
  for(const item of plan.evidence??[]){
    const subjects=item.subject.kind==='claim'?plan.claims:item.subject.kind==='asset'?plan.assets:item.subject.kind==='quantity'?plan.quantities:plan.views;
    if(!subjects.some(subject=>subject.id===item.subject.id))throw Error('An evidence record refers to an unknown subject.');
    if(item.anchorIds.length)checkAnchors(item.anchorIds);
    if(item.origin==='source-quotation'&&(item.subject.kind!=='claim'||!plan.claims.some(claim=>claim.id===item.subject.id&&claim.kind==='source')))throw Error('Only a source quotation can declare source-quotation evidence.');
    if(['source-extracted','observed-data','independent-reference'].includes(item.origin)&&!item.anchorIds.length&&!item.references.length)throw Error('This evidence origin needs a source anchor or explicit reference.');
    unique(item.dependsOn,'evidence dependency');visitEvidence(item.id);
  }
  for(const report of plan.reportedChecks??[]){const subjects=report.subject.kind==='claim'?plan.claims:report.subject.kind==='asset'?plan.assets:report.subject.kind==='quantity'?plan.quantities:plan.views;if(!subjects.some(subject=>subject.id===report.subject.id))throw Error('A reported check refers to an unknown subject.');}
  if(plan.navigation){unique(plan.navigation.selections.map(selectionChannel),'selection channel');if(plan.navigation.revision!==representationInputRevision(plan)||plan.navigation.selections.some(selection=>!isRepresentationSelection(plan,selection)))throw Error('Saved selections do not match current source/inputs. The original file is retained.');}
  return plan;
}

/** Wrap an existing snapshot without changing its source, input, view or authorship. */
export function representationFromWidget(input: WidgetEnvelope, source: SourceDocument): RepresentationPlan {
  const widget=validateWidgetEnvelope(input,source);
  return validateRepresentationPlan({
    format:'paperplay-representation',schemaVersion:1,id:widget.id,title:widget.title,
    source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:widget.authorship,objective:widget.spec.mapping,
    anchors:[{id:'passage',blockId:widget.source.blockId,page:widget.source.page,quote:widget.source.quote}],
    claims:[{id:'mapping',kind:'pedagogical-addition',text:widget.spec.mapping,anchorIds:['passage']}],assumptions:[],requestedEvidence:widget.spec.kind==='diagram'?'illustrative-walkthrough':'simplified-illustration',
    assets:[],quantities:[],execution:{kind:'local-computation',capabilities:[{id:'widget-v2',version:'2.1.0'}],assetIds:[]},interactions:['widget-controls','return-source'],views:[{id:'figure',kind:'widget',widget}],
  },source);
}
