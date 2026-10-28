import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedPapers} from '../data/papers';
import {metaReadingWidgets,readingWidgets,saveWidgetWorkspace,validateWorkspace,workspaceKey} from '../lib/experiments/workspace';
import {validateWidgetEnvelope,type WidgetEnvelope} from '../shared/widgets';

const source=preparedPapers[0].document;
function savedFigures(){
 const fixture=readingWidgets(source)[0];
 return (['prepared','user','imported','meta'] as const).map(kind=>validateWidgetEnvelope({...fixture,id:`saved-${kind}`,title:kind==='meta'?'A model-selected teaching interaction':fixture.title,authorship:{kind,label:`${kind} saved figure`}},source));
}

test('normal reading displays only model-selected saved figures, even for prepared sources with matching algorithm keywords',()=>{
 const figures=savedFigures(),original=JSON.stringify(figures);
 assert.equal(readingWidgets(source).length,1); // The bank/legacy fixture remains available, but is not a reading decision.
 assert.deepEqual(metaReadingWidgets(figures).map(widget=>widget.id),['saved-meta']);
 assert.deepEqual(metaReadingWidgets([]),[]);
 assert.equal(JSON.stringify(figures),original);
});

test('an explicitly shared saved figure is visible without making other authored fixtures automatic suggestions',()=>{
 const figures=savedFigures();
 assert.deepEqual(metaReadingWidgets(figures,['saved-user']).map(widget=>widget.id),['saved-user','saved-meta']);
 assert.deepEqual(metaReadingWidgets(figures,['unrelated']).map(widget=>widget.id),['saved-meta']);
 assert.deepEqual(metaReadingWidgets(figures).map(widget=>widget.id),['saved-meta']);
});

test('interacting with a visible Meta figure preserves hidden historical workspace originals',()=>{
 const figures=savedFigures(),data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 saveWidgetWorkspace(figures,source,storage);
 const all=validateWorkspace(JSON.parse(storage.getItem(workspaceKey(source))!),source),visible=metaReadingWidgets(all);
 assert.equal(visible.length,1);
 const changed:WidgetEnvelope={...visible[0],seed:73};
 saveWidgetWorkspace(all.map(widget=>widget.id===changed.id?changed:widget),source,storage);
 const restored=validateWorkspace(JSON.parse(storage.getItem(workspaceKey(source))!),source);
 assert.equal(restored.length,4);assert.equal(restored.find(widget=>widget.id==='saved-meta')!.seed,73);
 assert.deepEqual(restored.filter(widget=>widget.authorship.kind!=='meta'),figures.filter(widget=>widget.authorship.kind!=='meta'));
});
