import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedPapers } from '../data/papers';
import { createPreparedExperiment } from '../lib/prepared-figures';
import { snapshotFromPrepared } from '../lib/reading-state';
import { authoredExplanation, buildSearchEntries, createPersonalNote, defaultReadingPreferences, exportNotesBundle, glossaryFor, noteLocation, parseNotesBundle, readNotes, readingPreferencesSchema, saveNotes, searchEntries } from '../lib/reading/personal';
import { createStudyPack } from '../lib/reading/study-pack';
import { createWidgetForSource } from '../lib/widgets/presets';

const quadratic = preparedPapers.find(paper => paper.id === 'quadratic-optimization')!;

test('annotation identity preserves repeated quotes and surfaces changed/missing source instead of moving a highlight', () => {
  const source = quadratic.document;
  const note = createPersonalNote(source,'q-context',{kind:'highlight',quote:'convex quadratic',text:'Check this assumption'});
  assert.equal(noteLocation(note,source),'resolved');
  assert.equal(noteLocation(note,{...source,sourceVersion:'changed'}),'source-changed');
  assert.equal(noteLocation({...note,blockId:'q-gradient'},source),'missing-passage');
  assert.throws(()=>createPersonalNote(source,'q-context',{quote:'an invented quotation'}),/does not match/);
  const encoded = exportNotesBundle([note]); const decoded = parseNotesBundle(encoded);
  assert.deepEqual(decoded,[note]); assert.throws(()=>parseNotesBundle(JSON.stringify({format:'paperplay-notes',version:1,notes:[note,note]})),/repeated/);
});

test('notes retain bounded validated experiments while rejecting job credentials and invalid storage', () => {
  const snapshot = snapshotFromPrepared(quadratic,createPreparedExperiment(quadratic));
  const note = createPersonalNote(quadratic.document,'q-objective',{text:'Pinned example',experiment:snapshot});
  const storage = new Map<string,string>(); const adapter={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>{storage.set(key,value);}};
  saveNotes([note],adapter);assert.deepEqual(readNotes(adapter)[0].experiment,snapshot);
  const poisoned={...note,providerJobToken:'must not travel'};
  assert.throws(()=>parseNotesBundle(JSON.stringify({format:'paperplay-notes',version:1,notes:[poisoned]})));
  assert.throws(()=>saveNotes([note],{setItem(){throw Error('quota');}}),/quota/);
});

test('scoped symbols, authored examples and search retain source identities and exact numeric teaching claims', () => {
  const source=quadratic.document;
  const gradient=glossaryFor(source,'q-gradient'); assert(gradient.some(item=>item.term==='α (alpha)')); assert(!glossaryFor(source,'q-context').some(item=>item.term==='α (alpha)'));
  const personal=createPersonalNote(source,'q-context',{kind:'definition',tags:['model'],text:'My scoped model definition'});
  assert(glossaryFor(source,'q-context',[personal]).some(item=>item.provenance==='Personal definition'));
  assert(!glossaryFor(source,'q-objective',[personal]).some(item=>item.term==='model'));
  assert.match(authoredExplanation(source,'q-gradient')!.example,/0\.5/);
  const index=buildSearchEntries([source],[personal]);const results=searchEntries(index,'model definition');assert.equal(results[0].documentId,source.id);assert.equal(results[0].sourceVersion,source.sourceVersion);
  assert(searchEntries(buildSearchEntries([source],[]),'My scoped model definition').length===0);
});

test('reading preferences restrict domains and the study pack has explicit content inclusion without capabilities', () => {
  assert.equal(defaultReadingPreferences.fontSize,20); assert.throws(()=>readingPreferencesSchema.parse({...defaultReadingPreferences,fontSize:11})); assert.throws(()=>readingPreferencesSchema.parse({...defaultReadingPreferences,lineHeight:1}));
  const source=quadratic.document; const snapshot=snapshotFromPrepared(quadratic,createPreparedExperiment(quadratic));
  const pack=createStudyPack({source,includeSource:false,figures:[{title:'Actual current state',text:'Iteration 0; current residual 8.06. Totals for the complete run are separate.',svg:[],snapshot}]});
  assert(!pack.includes('One nice model is the convex quadratic.'));assert(pack.includes('gradient-descent'));assert(pack.includes('not an automatically recomputed experiment'));
  assert(!pack.includes('providerJob'));assert(!pack.includes('deleteToken'));assert(!pack.includes('<script'));
  const full=createStudyPack({source,includeSource:true,figures:[]});assert(full.includes('One nice model is the convex quadratic.'));assert(full.includes('Gabriel Goh'));
  assert.throws(()=>createStudyPack({source,includeSource:false,figures:[],original:{name:'a.pdf',base64:'JVBERi0='}}),/requires source/);
});


test('new widget study-pack metadata is source-validated and visual payloads are inert image resources', () => {
  const source=quadratic.document;const widget=createWidgetForSource('equation',source,'q-objective');
  const pack=createStudyPack({source,includeSource:false,appOrigin:'https://paperplay.example',figures:[{title:'Quadratic probe',text:'Computed synthetic objective',svg:['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>x</text></svg>'],widgetSnapshot:widget}]});
  assert(pack.includes('Exact versioned widget data and controls'));assert(pack.includes('paperplay-widget'));assert(pack.includes('CC BY 2.0'));assert(!pack.includes('<script'));assert(pack.includes('data:image/svg+xml'));assert(pack.includes('https://paperplay.example/#widget='));
  assert.throws(()=>createStudyPack({source:{...source,sourceVersion:'other'},includeSource:false,figures:[{title:'Wrong source',text:'x',svg:[],widgetSnapshot:widget}]}),/source version/);
});


test('new widget-linked annotations retain source binding and bounded portable controls', () => {
  const source=quadratic.document;const widget=createWidgetForSource('equation',source,'q-objective');
  const note=createPersonalNote(source,'q-objective',{text:'Change curvature next time',widgetExperiment:widget});
  assert.deepEqual(parseNotesBundle(exportNotesBundle([note]))[0].widgetExperiment,widget);
  assert.throws(()=>createPersonalNote(source,'q-context',{text:''}),/Write a note/);
  assert.throws(()=>createPersonalNote({...source,sourceVersion:'other'},'q-objective',{text:'Wrong edition',widgetExperiment:widget}),/source version/);
});
