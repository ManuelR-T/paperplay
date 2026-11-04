import test from 'node:test';
import assert from 'node:assert/strict';
import {conceptConnection,layoutConceptNodes,placeEdgeLabels,type ConceptNodeBox} from '../components/widgets/concept-layout';

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

const mergeNodes=[
  {id:'mid',label:'Middle n/2 = 12',x:50,y:10},{id:'a',label:'Run A len 8',x:20,y:35},{id:'d',label:'Run D len 4',x:80,y:35},
  {id:'b',label:'Run B len 2',x:40,y:45},{id:'left',label:'Sort left A+B',x:30,y:55},{id:'c',label:'Run C len 10',x:60,y:55},
  {id:'root',label:'Root cut at 10',x:45,y:60},{id:'right',label:'Sort right C+D',x:65,y:75},{id:'merge',label:'Merge results',x:50,y:90},
];
const mergeEdges=[
  {source:'mid',target:'c',label:'inside'},{source:'c',target:'root',label:'nearest'},{source:'root',target:'left',label:'recurse'},
  {source:'root',target:'right',label:'recurse'},{source:'left',target:'merge',label:'merge'},{source:'right',target:'merge',label:'merge'},
];
const center=(layout:ReturnType<typeof layoutConceptNodes>,id:string)=>layout.nodes.find(node=>node.id===id)!;

test('connected diagrams flow in rows along their connections, keeping authored column order',()=>{
  const layout=layoutConceptNodes(mergeNodes,mergeEdges);
  assertReadableBoxes(layout);
  const y=(id:string)=>center(layout,id).y;
  assert.ok(y('mid')<y('c')&&y('c')<y('root')&&y('root')<y('left')&&y('left')<y('merge'),'each connection points down a row');
  assert.equal(y('left'),y('right'),'siblings share a row');
  assert.ok(center(layout,'left').x<center(layout,'right').x,'left-to-right order follows Meta');
  for(const edge of mergeEdges){
    const line=conceptConnection(center(layout,edge.source),center(layout,edge.target)),mx=(line.x1+line.x2)/2,my=(line.y1+line.y2)/2;
    for(const box of layout.nodes)assert.ok(!(Math.abs(mx-box.x)<box.width/2&&Math.abs(my-box.y)<box.height/2),`label of ${edge.source}→${edge.target} is not covered by ${box.id}`);
  }
});

test('an upward-drawn flow stays upward, and cycles are layered by reversing their back edges',()=>{
  const nodes=[{id:'leaf',label:'Leaf',x:50,y:90},{id:'mid',label:'Middle',x:50,y:50},{id:'top',label:'Top',x:50,y:10}];
  const upward=layoutConceptNodes(nodes,[{source:'leaf',target:'mid'},{source:'mid',target:'top'}]);
  assert.ok(center(upward,'leaf').y>center(upward,'mid').y&&center(upward,'mid').y>center(upward,'top').y);
  const cyclic=layoutConceptNodes(nodes,[{source:'leaf',target:'mid'},{source:'mid',target:'leaf'}]);
  assertReadableBoxes(cyclic);assert.equal(cyclic.routes?.size,2,'both directions of a cycle are routed');
});

test('fan-out labels are shared once and no connection label covers a box or another label',()=>{
  const nodes=[{id:'s',label:'Shared trunk S',x:20,y:10},...[1,2,3].map(i=>({id:`q${i}`,label:`Question q${i}`,x:20+i*20,y:45})),{id:'flat',label:'One flat stream S|q1|q2|q3',x:75,y:85}];
  const edges=[...[1,2,3].map(i=>({id:`s${i}`,source:'s',target:`q${i}`,label:'sees trunk+self'})),
    {id:'f1',source:'q1',target:'flat',label:'packed side-by-side'},{id:'f2',source:'q2',target:'flat',label:'no delimiter'},{id:'f3',source:'q3',target:'flat',label:'isolated siblings'}];
  const layout=layoutConceptNodes(nodes,edges),labels=placeEdgeLabels(layout.nodes,edges);
  assert.deepEqual(['s1','s2','s3'].map(id=>labels.get(id)===null),[true,false,true],'the repeated fan-out label appears once, on the middle arrow');
  const rects=edges.flatMap(edge=>{const at=labels.get(edge.id);return at?[{id:edge.id,...at,width:edge.label.length*7.4+10,height:18}]:[];});
  assert.equal(rects.length,4);
  for(const rect of rects){
    for(const box of layout.nodes)assert.ok(!(Math.abs(rect.x-box.x)<(rect.width+box.width)/2&&Math.abs(rect.y-box.y)<(rect.height+box.height)/2),`${rect.id} label clears ${box.id}`);
    for(const other of rects)if(other!==rect)assert.ok(!(Math.abs(rect.x-other.x)<(rect.width+other.width)/2&&Math.abs(rect.y-other.y)<(rect.height+other.height)/2),`${rect.id} and ${other.id} labels do not overlap`);
  }
});

test('a two-arrow fan keeps both labels',()=>{
  const layout=layoutConceptNodes(mergeNodes,mergeEdges),labels=placeEdgeLabels(layout.nodes,mergeEdges.map((edge,i)=>({...edge,id:`m${i}`})));
  assert.ok([...labels.values()].every(Boolean),'every arrow in a pair is labelled');
});

test('long connections have finite routed waypoints and accept colon-containing node ids',()=>{
  const nodes=[{id:'node:a',label:'Start',x:50,y:0},{id:'b',label:'Middle',x:50,y:50},{id:'c',label:'End',x:50,y:100}];
  const edges=[{source:'node:a',target:'b'},{source:'b',target:'c'},{source:'node:a',target:'c'}];
  const layout=layoutConceptNodes(nodes,edges);
  assert.equal(layout.routes?.get(2)?.length,3);
  for(const route of layout.routes!.values())for(const point of route){assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.ok(point.x>=0&&point.x<=layout.width);}
});

test('an iterative loop (fit → correct → sample → refresh) is layered without overlaps or covered labels',()=>{
  const nodes=[{id:'buffer',label:'Buffer D_n',x:10,y:40},{id:'denoiser',label:'Denoiser m',x:35,y:40},{id:'correction',label:'Correction f',x:60,y:40},{id:'sampler',label:'Sampler q_n+1',x:85,y:55}];
  const edges=[{id:'e1',source:'buffer',target:'denoiser',label:'fit'},{id:'e2',source:'denoiser',target:'correction',label:'freeze m, learn f'},{id:'e3',source:'correction',target:'sampler',label:'sample SDE'},{id:'e4',source:'sampler',target:'buffer',label:'refresh buffer'}];
  const layout=layoutConceptNodes(nodes,edges);
  assertReadableBoxes(layout);assert.equal(layout.routes?.size,4,'every connection, including the loop back, is routed');
  const labels=placeEdgeLabels(layout.nodes,edges,layout.routes);
  for(const edge of edges){const at=labels.get(edge.id);assert.ok(at,`${edge.id} has a label`);
    for(const box of layout.nodes)assert.ok(!(Math.abs(at!.x-box.x)<(edge.label.length*7.4+10+box.width)/2&&Math.abs(at!.y-box.y)<(18+box.height)/2),`${edge.id} label clears ${box.id}`);}
});
