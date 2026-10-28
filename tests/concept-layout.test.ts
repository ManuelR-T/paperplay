import test from 'node:test';
import assert from 'node:assert/strict';
import {conceptConnection,layoutConceptNodes,type ConceptNodeBox} from '../components/widgets/concept-layout';

function assertReadableBoxes(layout:ReturnType<typeof layoutConceptNodes>){
  for(const box of layout.nodes){
    assert.ok(box.x-box.width/2>=24&&box.y-box.height/2>=24,'labels have canvas padding');
    assert.ok(box.x+box.width/2<=layout.width-24&&box.y+box.height/2<=layout.height-24,'labels stay inside the canvas');
  }
  for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
    const a=layout.nodes[i],b=layout.nodes[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2+18||Math.abs(a.y-b.y)>=(a.height+b.height)/2+18,`boxes ${a.id} and ${b.id} remain separated`);
  }
}

test('the real frontier/dependent diagram keeps every node and separates dense labels',()=>{
  const nodes=[
    ...[20,50,80].map((y,i)=>({id:`v${i+1}`,label:`Frontier v${i+1}`,x:15,y})),
    ...[15,30,45,60,85].map((y,i)=>({id:`right-${i}`,label:['Dep a1','Dep a2','Dep b1','Dep b2','Dep c1'][i],x:65,y})),
    ...[60,75].map((y,i)=>({id:`b${i+3}`,label:`Dep b${i+3}`,x:85,y})),
  ];
  const before=JSON.stringify(nodes),layout=layoutConceptNodes(nodes);
  assert.deepEqual(layout.nodes.map(node=>node.id),nodes.map(node=>node.id));
  assert.deepEqual(layout.nodes.map(node=>node.lines.join(' ')),nodes.map(node=>node.label));
  assertReadableBoxes(layout);assert.equal(JSON.stringify(nodes),before);
  assert.ok(layout.width<700&&layout.height<500,'this ten-node figure remains a compact readable canvas');
});

test('coincident positions and long concept labels remain selectable without overlapping boxes',()=>{
  const nodes=Array.from({length:6},(_,i)=>({id:`node-${i}`,label:`Distinct concept ${i}: a longer explanation of the mechanism`,x:50,y:50}));
  const layout=layoutConceptNodes(nodes);
  assert.equal(layout.nodes.length,nodes.length);assertReadableBoxes(layout);
  assert.deepEqual(layoutConceptNodes(nodes),layout,'layout is stable across renders');
  assert.ok(layout.nodes.every(node=>node.lines.length<=3));
});

test('diagram connections terminate at the label box borders',()=>{
  const box=(id:string,x:number,y:number):ConceptNodeBox=>({id,x,y,width:100,height:60,lines:[id]});
  assert.deepEqual(conceptConnection(box('a',0,0),box('b',200,0)),{x1:50,y1:0,x2:150,y2:0});
  assert.deepEqual(conceptConnection(box('a',0,0),box('b',0,200)),{x1:0,y1:30,x2:0,y2:170});
  assert.deepEqual(conceptConnection(box('a',0,0),box('b',200,200)),{x1:30,y1:30,x2:170,y2:170});
});
