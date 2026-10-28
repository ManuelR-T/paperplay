type ConceptNode={id:string;label:string;x:number;y:number};
export type ConceptNodeBox={id:string;x:number;y:number;width:number;height:number;lines:string[]};
const GAP=18,PADDING=24;

function labelLines(label:string){
  const words=label.trim().split(/\s+/).flatMap(word=>word.match(/.{1,18}/gu)??[]),lines:string[]=[];
  for(const word of words){const last=lines.length-1;if(last>=0&&lines[last].length+word.length+1<=18)lines[last]+=' '+word;else lines.push(word);}
  return lines.length<=3?lines:[...lines.slice(0,2),lines[2].slice(0,16)+'…'];
}

/** Physical label layout only. Every source node and its relative column order remain present. */
export function layoutConceptNodes(nodes:readonly ConceptNode[]):{nodes:ConceptNodeBox[];width:number;height:number}{
  if(!nodes.length)return {nodes:[],width:160,height:104};
  const boxes=nodes.map((node,index)=>{const lines=labelLines(node.label);return {id:node.id,index,x:node.x*6,y:node.y*3,width:Math.max(96,Math.max(...lines.map(line=>line.length))*9+28),height:Math.max(44,lines.length*20+20),lines};});
  const placed:typeof boxes=[];
  for(const box of [...boxes].sort((a,b)=>a.y-b.y||a.x-b.x||a.index-b.index)){
    for(const previous of placed){
      if(Math.abs(box.x-previous.x)<(box.width+previous.width)/2+GAP)box.y=Math.max(box.y,previous.y+(box.height+previous.height)/2+GAP);
    }
    placed.push(box);
  }
  const left=Math.min(...boxes.map(box=>box.x-box.width/2)),top=Math.min(...boxes.map(box=>box.y-box.height/2));
  const right=Math.max(...boxes.map(box=>box.x+box.width/2)),bottom=Math.max(...boxes.map(box=>box.y+box.height/2));
  return {width:Math.ceil(right-left+PADDING*2),height:Math.ceil(bottom-top+PADDING*2),nodes:boxes.map(({index:_,...box})=>({...box,x:box.x-left+PADDING,y:box.y-top+PADDING}))};
}

/** End connections at the box border so arrowheads remain visible outside the labels. */
export function conceptConnection(a:ConceptNodeBox,b:ConceptNodeBox){
  const dx=b.x-a.x,dy=b.y-a.y;
  const boundary=(box:ConceptNodeBox)=>Math.min(dx?box.width/2/Math.abs(dx):Infinity,dy?box.height/2/Math.abs(dy):Infinity);
  if(!dx&&!dy)return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};
  const start=boundary(a),end=boundary(b);
  return {x1:a.x+dx*start,y1:a.y+dy*start,x2:b.x-dx*end,y2:b.y-dy*end};
}
