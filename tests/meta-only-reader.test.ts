import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedPapers} from '../data/papers';
import {explicitReadingWidgets,readingWidgets,saveWidgetWorkspace,validateWorkspace,workspaceKey} from '../lib/experiments/workspace';
import {validateWidgetEnvelope,type WidgetEnvelope} from '../shared/widgets';

const source=preparedPapers[0].document;
function savedFigures(){
 const fixture=readingWidgets(source)[0];
 return (['prepared','user','imported','meta'] as const).map(kind=>validateWidgetEnvelope({...fixture,id:`saved-${kind}`,title:kind==='meta'?'A model-selected teaching interaction':fixture.title,authorship:{kind,label:`${kind} saved figure`}},source));
}

test('historical Meta authorship does not insert saved figures outside the new whole-paper plan',()=>{
 const figures=savedFigures(),original=JSON.stringify(figures);
 assert.equal(readingWidgets(source).length,1); // The bank/legacy fixture remains available, but is not a reading decision.
 assert.deepEqual(explicitReadingWidgets(figures),[]);
 assert.deepEqual(explicitReadingWidgets([]),[]);
 assert.equal(JSON.stringify(figures),original);
});

test('an explicit saved-figure choice displays that figure alone without adding other historical Meta figures',()=>{
 const figures=savedFigures();
 assert.deepEqual(explicitReadingWidgets(figures,['saved-user']).map(widget=>widget.id),['saved-user']);
 assert.deepEqual(explicitReadingWidgets(figures,['saved-meta']).map(widget=>widget.id),['saved-meta']);
 assert.deepEqual(explicitReadingWidgets(figures,['unrelated']),[]);
 assert.deepEqual(explicitReadingWidgets(figures),[]);
});

test('interacting with a visible Meta figure preserves hidden historical workspace originals',()=>{
 const figures=savedFigures(),data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 saveWidgetWorkspace(figures,source,storage);
 const all=validateWorkspace(JSON.parse(storage.getItem(workspaceKey(source))!),source),visible=explicitReadingWidgets(all,['saved-meta']);
 assert.equal(visible.length,1);
 const changed:WidgetEnvelope={...visible[0],seed:73};
 saveWidgetWorkspace(all.map(widget=>widget.id===changed.id?changed:widget),source,storage);
 const restored=validateWorkspace(JSON.parse(storage.getItem(workspaceKey(source))!),source);
 assert.equal(restored.length,4);assert.equal(restored.find(widget=>widget.id==='saved-meta')!.seed,73);
 assert.deepEqual(restored.filter(widget=>widget.authorship.kind!=='meta'),figures.filter(widget=>widget.authorship.kind!=='meta'));
});
