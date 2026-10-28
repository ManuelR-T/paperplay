import {z} from 'zod';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import {WIDGET_KINDS,widgetSpecSchema,validateWidgetSpec} from '../../shared/widgets';
import {sourceBlockText,type SourceSection} from './sections';

export const WHOLE_PAPER_SECTION_ID='whole-paper';
export const PAPER_ILLUSTRATION_KINDS=[...WIDGET_KINDS,'generated'] as const;
const prose=z.string().trim().min(1).refine(value=>!/<\/?(?:script|iframe|style)\b|javascript\s*:/i.test(value),'Use plain explanatory text.');
const locator={blockId:z.string().min(1).max(100),page:z.number().int().min(1).max(500),quote:prose.max(1000)};
const guideText=z.string().trim().min(1).max(600).refine(value=>!/<\/?[a-z][^>]*>|javascript\s*:/i.test(value),'Use plain explanatory text.');
/** The implementation describes the controls that actually exist, rather than an editorial wish. */
export const paperReadingGuideSchema=z.strictObject({whyHere:guideText,learningGoal:guideText,interaction:guideText,expectedInsight:guideText});
export type PaperReadingGuide=z.infer<typeof paperReadingGuideSchema>;
export const paperFigureBriefSchema=z.strictObject({
 id:z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/),title:prose.max(200),...locator,
 kind:z.enum(PAPER_ILLUSTRATION_KINDS),whyHere:prose.max(600),learningGoal:prose.max(600),
 interaction:prose.max(600),expectedInsight:prose.max(600),brief:prose.max(2000),reuseId:z.string().min(1).max(100).nullable(),
});
export type PaperFigureBrief=z.infer<typeof paperFigureBriefSchema>;
export const paperPlanSchema=z.strictObject({summary:prose.max(2000),figures:z.array(paperFigureBriefSchema).max(12)});
export type PaperPlan=z.infer<typeof paperPlanSchema>;
export const existingPaperFigureSchema=z.strictObject({id:z.string().min(1).max(100),title:prose.max(200),kind:z.enum(PAPER_ILLUSTRATION_KINDS),blockId:locator.blockId,quote:locator.quote,mapping:prose.max(2000),spec:widgetSpecSchema.optional()});
export type ExistingPaperFigure=z.infer<typeof existingPaperFigureSchema>;
const normalized=(value:string)=>value.replace(/\s+/g,' ').trim();

/** Entire imported source in reading order. No excerpting, section selection or silent truncation. */
export function wholePaperContext(input:SourceDocument){
 const source=validateDocument(input);
 const segments=source.blocks.map(block=>({blockId:block.id,page:block.page,start:0,end:sourceBlockText(block).length,text:sourceBlockText(block)}));
 if(!segments.some(segment=>segment.text.trim()))throw Error('The saved paper contains no readable content. Import its complete source before illustration planning.');
 const section:SourceSection={id:WHOLE_PAPER_SECTION_ID,title:source.title,segments,characters:segments.reduce((sum,segment)=>sum+segment.text.length,0),partial:false};
 const text=JSON.stringify({title:source.title,authors:source.authors,sourceVersion:source.sourceVersion,source:source.source,sourceLink:source.source.url??null,pageCount:source.pageCount,
  blocks:source.blocks.map(block=>({...block,blockId:block.id})),extractionWarnings:source.extractionWarnings,
  coverage:'All saved source blocks are supplied in reading order, without section excerpts or truncation. Source-figure captions and image references are included; image pixels are not supplied. Extraction warnings describe any limitations of the imported source.'});
 return {section,text,sections:[section]};
}

export function validatePaperFigureBrief(input:unknown,source:SourceDocument):PaperFigureBrief{
 const brief=paperFigureBriefSchema.parse(input),block=source.blocks.find(block=>block.id===brief.blockId);
 if(!block||block.page!==brief.page||normalized(brief.quote).length<12||!normalized(sourceBlockText(block)).includes(normalized(brief.quote)))throw Error('The planned illustration must cite an exact block, page and quote from the complete saved paper.');
 return brief;
}

export function validateExistingPaperFigures(input:unknown,source:SourceDocument):ExistingPaperFigure[]{
 const figures=z.array(existingPaperFigureSchema).max(3000).parse(input),ids=new Set<string>();
 for(const figure of figures){
  if(ids.has(figure.id))throw Error('Saved illustration identifiers must be unique.');ids.add(figure.id);
  if(figure.spec){validateWidgetSpec(figure.spec);if(figure.spec.kind!==figure.kind)throw Error('A saved illustration kind must match its actual configuration.');}
  const block=source.blocks.find(block=>block.id===figure.blockId);
  if(!block||!normalized(sourceBlockText(block)).includes(normalized(figure.quote)))throw Error('A saved illustration summary does not match this paper.');
 }
 return figures;
}

/** Only Meta chooses what to keep; validation checks references, never pedagogical keyword relevance. */
export function validatePaperPlan(input:unknown,source:SourceDocument,existing:readonly ExistingPaperFigure[]=[]):PaperPlan{
 const plan=paperPlanSchema.parse(input),ids=new Set<string>(),reused=new Set<string>();
 for(const figure of plan.figures){
  validatePaperFigureBrief(figure,source);
  if(ids.has(figure.id))throw Error('The paper plan repeats an illustration identifier.');ids.add(figure.id);
  if(figure.reuseId!==null){const saved=existing.find(item=>item.id===figure.reuseId);
   if(!saved||saved.kind!==figure.kind||saved.blockId!==figure.blockId||reused.has(figure.reuseId))throw Error('A reused illustration must identify one supplied saved figure with the same kind and source placement.');
   reused.add(figure.reuseId);
  }
 }
 return plan;
}
