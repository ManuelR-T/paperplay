import type { SourceDocument } from '../../shared/schema';

/** Top-left normalized page coordinates; reviewed against the bundled unchanged publisher PDFs. */
export type OriginalFigureCrop = { x: number; y: number; width: number; height: number };
const reviewed: Record<string, { page: number; crop: OriginalFigureCrop }> = {
  'priority-search-trees:g-original-figure-3': { page:14, crop:{x:103/595.276,y:94/841.89,width:406/595.276,height:286/841.89} },
  'adaptive-mergesort:s-original-figure-1': { page:6, crop:{x:105/595.276,y:96/841.89,width:402/595.276,height:129/841.89} },
  'adaptive-mergesort:s-original-figure-2': { page:9, crop:{x:175/595.276,y:96/841.89,width:230/595.276,height:59/841.89} },
  'adaptive-mergesort:s-original-algorithm-2': { page:10, crop:{x:103/595.276,y:95/841.89,width:406/595.276,height:311/841.89} },
};

export function originalFigureCrop(source: SourceDocument, blockId: string): OriginalFigureCrop | undefined {
  const versions:Record<string,string>={'priority-search-trees':'LIPIcs.ITP.2019.23-publisher-2019-09-05','adaptive-mergesort':'LIPIcs.ESA.2018.63-publisher-2018-08-14'};
  if(versions[source.id]!==source.sourceVersion)return;
  const block=source.blocks.find(b=>b.id===blockId);
  if(source.source.kind!=='prepared'||block?.kind!=='original-figure')return;
  const match=reviewed[`${source.id}:${blockId}`];
  return match?.page===block.page ? match.crop : undefined;
}
