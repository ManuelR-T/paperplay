import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync,readFileSync,statSync } from 'node:fs';
import {resolve,dirname} from 'node:path';
import { readScientificCorpus, reportScientificCorpus } from '../lib/evaluation/scientific-corpus';
const corpus=readScientificCorpus();
test('scientific intake has twelve attributed, version-pinned cases and frozen independent split',()=>{
 assert.equal(corpus.papers.length,12);for(const domain of ['biology','physics','computer-science'])assert.equal(corpus.papers.filter(p=>p.domain===domain).length,4);
 assert.deepEqual(corpus.papers.filter(p=>p.split==='held-out').map(p=>p.id),['B3','P3','P4','C4']);
 assert.equal(corpus.papers.filter(p=>p.split==='development').length,8);
 for(const p of corpus.papers){assert.ok(p.source.edition&&p.source.locator&&p.authors.length);assert.equal(p.source.contentStored,false);assert.equal(p.source.storedContentSha256,null);assert.equal(p.rights.storagePolicy,'metadata-and-links-only');assert.equal(p.expected.expertReview,'pending');}
 assert.equal(corpus.papers.find(p=>p.id==='C4')!.identifiers.doi,null);
 assert.equal(corpus.papers.find(p=>p.id==='P4')!.identifiers.arxiv,'hep-th/0405152v3');
 assert.ok(corpus.papers.find(p=>p.id==='P4')!.expected.omissions.some(x=>x.includes('multi-interval')));
 const changed=structuredClone(corpus);changed.papers[0].split='held-out';assert.throws(()=>readScientificCorpus(changed),/digest/);
});
test('intake distinguishes inspected passages from unresolved image/full-text admission and rights',()=>{
 const hh=corpus.papers.find(p=>p.id==='B1')!;assert.ok(hh.source.locator.includes('501'));assert.equal(hh.source.admission,'body-locator-inspected');
 const image=corpus.papers.find(p=>p.id==='P3')!;assert.equal(image.imageHeavy,true);assert.equal(image.source.admission,'institutional-locator-only');assert.equal(image.rights.license,'unknown');
 assert.equal(corpus.papers.find(p=>p.id==='B3')!.source.admission,'metadata-only');
 assert.ok(corpus.papers.some(p=>p.crossDomains.length));
 for(const scenario of corpus.scenarios){assert.ok(scenario.intentionallyOmitted.length&&scenario.expectedFallback&&scenario.forbiddenClaims.length);assert.ok(scenario.reason.includes('Chosen evaluation input restriction'));}
 const invalid=structuredClone(corpus);invalid.scenarios[0].paperId='invented';assert.throws(()=>readScientificCorpus(invalid),/Unknown scenario paper/);
});
test('coverage report counts requested modalities/evidence separately from performed evaluation',()=>{
 const report=reportScientificCorpus();assert.deepEqual(report.counts.byDomain,{biology:4,'computer-science':4,physics:4});assert.deepEqual(report.counts.byRequestedEvidence,{illustration:12});assert.equal(report.counts.incompleteScenarios,4);
 assert.equal(report.counts.executedPapers,0);assert.equal(report.counts.independentlyVerifiedPapers,0);assert.equal(report.counts.expertReviewedPapers,0);assert.equal(report.counts.modelRuns,0);assert.equal(report.counts.humanSessions,0);
 assert.ok(report.cases.find(p=>p.id==='B1')!.capabilityGaps.length);
 assert.equal(report.cases.find(p=>p.id==='P3')!.sourceLinkedFallback,'Source passage admission required before any source-linked representation.');
 assert.ok(report.cases.every(p=>p.scientificVerification==='not-evaluated'&&!p.executed));
});
test('held-out paper identifiers do not enter development source fixtures, prompts or recipes',()=>{
 // Intake metadata is permitted here. App imports of the corpus are forbidden: this is not a retrieval catalog for Muse.
 const forbidden=corpus.papers.filter(p=>p.split==='held-out').flatMap(p=>[p.title,p.identifiers.doi,p.identifiers.arxiv,p.identifiers.canonicalUrl]).filter((x):x is string=>!!x);
 const files:string[]=[];function walk(dir:string){for(const name of readdirSync(dir)){const path=`${dir}/${name}`;if(statSync(path).isDirectory())walk(path);else if(/\.(ts|tsx|json|md|txt)$/.test(path))files.push(path);}}
 for(const directory of ['data','lib','shared','components','server','scripts'])walk(directory);
 for(const path of files){if(['data/scientific-corpus.json','lib/evaluation/scientific-corpus.ts','scripts/report-scientific-corpus.ts'].includes(path))continue;
   const contents=readFileSync(path,'utf8');for(const identifier of forbidden)assert.ok(!contents.includes(identifier),`Held-out identifier leaked into ${path}`);
   if(path!=='lib/evaluation/frozen-evaluation.ts')assert.ok(!contents.includes('scientific-corpus.json'),`Intake corpus imported by development path ${path}`);
 }
});

test('only the explicit offline evaluation CLI may import the frozen evaluator; reader/provider/development code cannot load it',()=>{
 const files:string[]=[];function walk(dir:string){for(const name of readdirSync(dir)){const path=`${dir}/${name}`;if(statSync(path).isDirectory())walk(path);else if(/\.(ts|tsx|mjs|js)$/.test(path))files.push(path);}}
 for(const directory of ['app','components','server','lib','shared','data','scripts'])walk(directory);
 const evaluator=resolve('lib/evaluation/frozen-evaluation');
 for(const path of files){const contents=readFileSync(path,'utf8');
  // Static ESM imports/reexports and literal dynamic imports/CommonJS requires;
  // this is a repository dependency guard, not a hostile-code admission parser.
  for(const match of contents.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)){
   const specifier=match[1],target=specifier.startsWith('@/')?resolve(specifier.slice(2)):specifier.startsWith('.')?resolve(dirname(path),specifier):specifier;
   if(target.replace(/\.(?:ts|tsx|mjs|js)$/,'')===evaluator)assert.equal(path,'scripts/evaluate-scientific-corpus.ts',`Frozen evaluation may not enter development/runtime path ${path}`);
  }
 }
});
