type ConceptNode={id:string;label:string;x:number;y:number};
type ConceptEdge={source:string;target:string;label?:string};
export type ConceptNodeBox={id:string;x:number;y:number;width:number;height:number;lines:string[]};
const GAP=18,PADDING=24,RANK_GAP=28,LABELLED_RANK_GAP=58;

function labelLines(label:string){
  const words=label.trim().split(/\s+/).flatMap(word=>word.match(/.{1,18}/gu)??[]),lines:string[]=[];
  for(const word of words){const last=lines.length-1;if(last>=0&&lines[last].length+word.length+1<=18)lines[last]+=' '+word;else lines.push(word);}
  return lines.length<=3?lines:[...lines.slice(0,2),lines[2].slice(0,16)+'…'];
}

type Box={id:string;index:number;x:number;y:number;width:number;height:number;lines:string[];sourceX:number;sourceY:number};

/** Longest-path ranks for a diagram, with cycles broken at their back edges. */
function edgeRanks(boxes:Box[],edges:readonly ConceptEdge[]){
  const ids=new Set(boxes.map(box=>box.id));
  const valid=edges.filter(edge=>edge.source!==edge.target&&ids.has(edge.source)&&ids.has(edge.target));
  if(!valid.length)return undefined;
  // Cycle removal: a depth-first walk in authored top-to-bottom order marks edges back to an ancestor;
  // they are ranked as if reversed (and still drawn in their real direction).
  const state=new Map<string,1|2>(),back=new Set<ConceptEdge>();
  const visit=(id:string)=>{state.set(id,1);for(const edge of valid.filter(edge=>edge.source===id)){const next=state.get(edge.target);if(next===1)back.add(edge);else if(!next)visit(edge.target);}state.set(id,2);};
  for(const box of [...boxes].sort((a,b)=>a.sourceY-b.sourceY||a.sourceX-b.sourceX))if(!state.has(box.id))visit(box.id);
  const ranked=valid.map(edge=>back.has(edge)?{...edge,source:edge.target,target:edge.source}:edge);
  const incoming=new Map(boxes.map(box=>[box.id,0])),outgoing=new Map(boxes.map(box=>[box.id,[] as string[]]));
  for(const edge of ranked){incoming.set(edge.target,incoming.get(edge.target)!+1);outgoing.get(edge.source)!.push(edge.target);}
  const connected=new Set(valid.flatMap(edge=>[edge.source,edge.target]));
  const rank=new Map<string,number>(),queue=boxes.filter(box=>connected.has(box.id)&&!incoming.get(box.id)).map(box=>box.id);
  for(const id of queue)rank.set(id,0);
  let visited=0;
  while(queue.length){const id=queue.shift()!;visited++;for(const next of outgoing.get(id)!){rank.set(next,Math.max(rank.get(next)??0,rank.get(id)!+1));incoming.set(next,incoming.get(next)!-1);if(!incoming.get(next))queue.push(next);}}
  if(visited<connected.size)return undefined; // unreachable after cycle removal; kept as a guard
  // Respect the vertical direction Meta drew: if most connections point upward, the flow runs bottom-up.
  const drift=ranked.reduce((sum,edge)=>sum+(boxes.find(box=>box.id===edge.target)!.sourceY-boxes.find(box=>box.id===edge.source)!.sourceY),0);
  const deepest=Math.max(...rank.values());
  if(drift<0)for(const [id,value] of rank)rank.set(id,deepest-value);
  // Unconnected nodes join the rank whose authored height is closest to theirs.
  const rankY=new Map<number,number>();
  for(let r=0;r<=deepest;r++){const members=boxes.filter(box=>rank.get(box.id)===r);rankY.set(r,members.reduce((sum,box)=>sum+box.sourceY,0)/Math.max(1,members.length));}
  for(const box of boxes)if(!rank.has(box.id)){let best=0;for(const [r,y] of rankY)if(Math.abs(y-box.sourceY)<Math.abs(rankY.get(best)!-box.sourceY))best=r;rank.set(box.id,best);}
  return {rank,labelled:valid.some(edge=>edge.label?.trim())};
}

type Point={x:number;y:number};
export type ConceptRoute=Point[];
type Slot={id:string;box?:Box;width:number;sourceX:number};

/** Edge crossings between two adjacent rows, from each link's positions in those rows. */
function crossingsBetween(links:[number,number][]){
  let count=0;
  for(let i=0;i<links.length;i++)for(let j=i+1;j<links.length;j++){const [a,b]=links[i],[c,d]=links[j];if((a-c)*(b-d)<0)count++;}
  return count;
}

/**
 * Layered layout (Sugiyama-style). Connections that skip rows get one waypoint per row so they
 * route between boxes; rows are reordered by neighbour barycentres to minimise crossings, then
 * pulled toward their neighbours. Returns a routed polyline for every connection.
 */
function layered(boxes:Box[],edges:readonly ConceptEdge[],rank:Map<string,number>,labelled:boolean):Map<number,ConceptRoute>{
  const rowRanks=[...new Set(rank.values())].sort((a,b)=>a-b),rowOf=new Map(rowRanks.map((r,i)=>[r,i]));
  const rows:Slot[][]=rowRanks.map(()=>[]),slotRow=new Map<string,number>();
  for(const box of boxes){const row=rowOf.get(rank.get(box.id)!)!;rows[row].push({id:box.id,box,width:box.width,sourceX:box.sourceX});slotRow.set(box.id,row);}
  const byId=new Map(boxes.map(box=>[box.id,box])),chains=new Map<number,string[]>();let dummies=0;
  edges.forEach((edge,index)=>{
    const a=byId.get(edge.source),b=byId.get(edge.target);if(!a||!b||a===b)return;
    const ra=slotRow.get(a.id)!,rb=slotRow.get(b.id)!;if(ra===rb)return;
    const chain=[a.id],step=rb>ra?1:-1;
    for(let row=ra+step;row!==rb;row+=step){const t=(row-ra)/(rb-ra),id=`~${dummies++}`;rows[row].push({id,width:12,sourceX:a.sourceX+(b.sourceX-a.sourceX)*t});slotRow.set(id,row);chain.push(id);}
    chain.push(b.id);chains.set(index,chain);
  });
  // Links between adjacent rows, oriented top row → bottom row.
  const links:[string,string][]=[];
  for(const chain of chains.values())for(let i=0;i+1<chain.length;i++){const [u,v]=[chain[i],chain[i+1]];links.push(slotRow.get(u)!<slotRow.get(v)!?[u,v]:[v,u]);}
  const up=new Map<string,string[]>(),down=new Map<string,string[]>();
  for(const [u,v] of links){down.set(u,[...(down.get(u)??[]),v]);up.set(v,[...(up.get(v)??[]),u]);}
  const order=rows.map(row=>[...row].sort((a,b)=>a.sourceX-b.sourceX||(a.box?.index??0)-(b.box?.index??0)));
  const position=(ordering:Slot[][])=>{const at=new Map<string,number>();ordering.forEach(row=>row.forEach((slot,i)=>at.set(slot.id,i)));return at;};
  const total=(ordering:Slot[][])=>{const at=position(ordering);let sum=0;for(let r=0;r+1<ordering.length;r++)sum+=crossingsBetween(links.filter(([u])=>slotRow.get(u)===r).map(([u,v])=>[at.get(u)!,at.get(v)!]));return sum;};
  let best=order.map(row=>[...row]),bestCount=total(best);
  for(let iteration=0;iteration<24&&bestCount>0;iteration++){
    const downward=iteration%2===0,at=position(order);
    const sequence=downward?order.map((_,r)=>r).slice(1):order.map((_,r)=>r).slice(0,-1).reverse();
    for(const r of sequence){
      const current=position(order);
      const bary=(slot:Slot)=>{const neighbours=(downward?up:down).get(slot.id)??[];return neighbours.length?neighbours.reduce((sum,id)=>sum+current.get(id)!,0)/neighbours.length:current.get(slot.id)!;};
      order[r]=order[r].map(slot=>({slot,key:bary(slot),i:current.get(slot.id)!})).sort((a,b)=>a.key-b.key||a.i-b.i).map(item=>item.slot);
    }
    void at;const count=total(order);if(count<bestCount){bestCount=count;best=order.map(row=>[...row]);}
  }
  // Coordinates: pack each row, then pull slots toward their neighbours without breaking order.
  const x=new Map<string,number>(),sep=(a:Slot,b:Slot)=>(a.width+b.width)/2+(a.box&&b.box?GAP*1.5:a.box||b.box?GAP:8);
  for(const row of best){let cursor=0;row.forEach((slot,i)=>{if(i)cursor+=sep(row[i-1],slot);x.set(slot.id,cursor);});const shift=cursor/2;for(const slot of row)x.set(slot.id,x.get(slot.id)!-shift);}
  for(let pass=0;pass<8;pass++){
    const sequence=pass%2===0?best.map((_,r)=>r):best.map((_,r)=>r).reverse();
    for(const r of sequence){
      const row=best[r],desired=row.map(slot=>{const neighbours=[...(up.get(slot.id)??[]),...(down.get(slot.id)??[])];return neighbours.length?neighbours.reduce((sum,id)=>sum+x.get(id)!,0)/neighbours.length:x.get(slot.id)!;});
      const left=[...desired],right=[...desired];
      for(let i=1;i<row.length;i++)left[i]=Math.max(left[i],left[i-1]+sep(row[i-1],row[i]));
      for(let i=row.length-2;i>=0;i--)right[i]=Math.min(right[i],right[i+1]-sep(row[i],row[i+1]));
      row.forEach((slot,i)=>x.set(slot.id,(left[i]+right[i])/2));
    }
  }
  // Rows top to bottom; dummies sit at their row's centre line.
  const gap=(labelled?LABELLED_RANK_GAP:RANK_GAP)+GAP,y=new Map<string,number>();let top=0;
  for(const row of best){const height=Math.max(44,...row.filter(slot=>slot.box).map(slot=>slot.box!.height));for(const slot of row){y.set(slot.id,top+height/2);if(slot.box){slot.box.x=x.get(slot.id)!;slot.box.y=top+height/2;}}top+=height+gap;}
  // Ports: connections leave the bottom/top edge of a box, spread in the order of their next point.
  const routes=new Map<number,ConceptRoute>(),ports=new Map<string,{index:number;end:'start'|'end';toward:number}[]>();
  for(const [index,chain] of chains){
    const first=chain[0],last=chain.at(-1)!,next=chain[1],previous=chain.at(-2)!;
    const side=(id:string,other:string)=>`${id}:${y.get(other)!>y.get(id)!?'bottom':'top'}`;
    ports.set(side(first,next),[...(ports.get(side(first,next))??[]),{index,end:'start',toward:x.get(next)!}]);
    ports.set(side(last,previous),[...(ports.get(side(last,previous))??[]),{index,end:'end',toward:x.get(previous)!}]);
  }
  const anchor=new Map<string,Point>();
  for(const [key,list] of ports){
    const divider=key.lastIndexOf(':'),id=key.slice(0,divider),edge=key.slice(divider+1),box=byId.get(id)!,sorted=[...list].sort((a,b)=>a.toward-b.toward),spread=Math.min(22,(box.width-24)/Math.max(1,sorted.length));
    sorted.forEach((port,i)=>anchor.set(`${port.index}:${port.end}`,{x:box.x+(i-(sorted.length-1)/2)*spread,y:box.y+(edge==='bottom'?1:-1)*box.height/2}));
  }
  for(const [index,chain] of chains)routes.set(index,[anchor.get(`${index}:start`)!,...chain.slice(1,-1).map(id=>({x:x.get(id)!,y:y.get(id)!})),anchor.get(`${index}:end`)!]);
  return routes;
}

/** Smooth path through a route: vertical tangents at every point, so rows read as clean S-curves. */
export function conceptRoutePath(route:ConceptRoute){
  let d=`M${route[0].x},${route[0].y}`;
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],mid=(a.y+b.y)/2;d+=` C${a.x},${mid} ${b.x},${mid} ${b.x},${b.y}`;}
  return d;
}

/** Points along a routed curve, for placing its label. */
export function conceptRouteSamples(route:ConceptRoute,steps=[0.5,0.3,0.7,0.2,0.8]){
  const out:Point[]=[];
  for(const t of steps){const scaled=t*(route.length-1),i=Math.min(route.length-2,Math.floor(scaled)),u=scaled-i,a=route[i],b=route[i+1],mid=(a.y+b.y)/2;
    const bez=(p0:number,p1:number,p2:number,p3:number)=>(1-u)**3*p0+3*(1-u)**2*u*p1+3*(1-u)*u**2*p2+u**3*p3;
    out.push({x:bez(a.x,a.x,b.x,b.x),y:bez(a.y,mid,mid,b.y)});}
  return out;
}

/** Free placement from authored coordinates: overlapping labels move down until separated. */
function separated(boxes:Box[]){
  const placed:Box[]=[];
  for(const box of [...boxes].sort((a,b)=>a.y-b.y||a.x-b.x||a.index-b.index)){
    for(const previous of placed){
      if(Math.abs(box.x-previous.x)<(box.width+previous.width)/2+GAP)box.y=Math.max(box.y,previous.y+(box.height+previous.height)/2+GAP);
    }
    placed.push(box);
  }
}

/** Physical label layout only. Every source node and its relative column order remain present. */
export function layoutConceptNodes(nodes:readonly ConceptNode[],edges:readonly ConceptEdge[]=[]):{nodes:ConceptNodeBox[];width:number;height:number;routes?:Map<number,ConceptRoute>}{
  if(!nodes.length)return {nodes:[],width:160,height:104};
  const boxes:Box[]=nodes.map((node,index)=>{const lines=labelLines(node.label);return {id:node.id,index,x:node.x*6,y:node.y*3,sourceX:node.x,sourceY:node.y,width:Math.max(96,Math.max(...lines.map(line=>line.length))*9+28),height:Math.max(44,lines.length*20+20),lines};});
  const ranks=edgeRanks(boxes,edges);
  const routes=ranks?layered(boxes,edges,ranks.rank,ranks.labelled):(separated(boxes),undefined);
  const points=[...(routes?.values()??[])].flat();
  const left=Math.min(...boxes.map(box=>box.x-box.width/2),...points.map(point=>point.x-8)),top=Math.min(...boxes.map(box=>box.y-box.height/2));
  const right=Math.max(...boxes.map(box=>box.x+box.width/2),...points.map(point=>point.x+8)),bottom=Math.max(...boxes.map(box=>box.y+box.height/2));
  const shift=(point:Point)=>({x:point.x-left+PADDING,y:point.y-top+PADDING});
  return {width:Math.ceil(right-left+PADDING*2),height:Math.ceil(bottom-top+PADDING*2),nodes:boxes.map(({index:_,sourceX:_x,sourceY:_y,...box})=>({...box,...shift(box)})),...(routes?{routes:new Map([...routes].map(([index,route])=>[index,route.map(shift)]))}:{})};
}

/** End connections at the box border so arrowheads remain visible outside the labels. */
export function conceptConnection(a:ConceptNodeBox,b:ConceptNodeBox){
  const dx=b.x-a.x,dy=b.y-a.y;
  const boundary=(box:ConceptNodeBox)=>Math.min(dx?box.width/2/Math.abs(dx):Infinity,dy?box.height/2/Math.abs(dy):Infinity);
  if(!dx&&!dy)return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};
  const start=boundary(a),end=boundary(b);
  return {x1:a.x+dx*start,y1:a.y+dy*start,x2:b.x-dx*end,y2:b.y-dy*end};
}

type LabelledEdge={id:string;source:string;target:string;label?:string};
type Rect={x:number;y:number;width:number;height:number};
const LABEL_HEIGHT=18,LABEL_MARGIN=4,LABEL_STEPS=[0.5,0.36,0.64,0.26,0.74,0.18,0.82];
const labelWidth=(text:string)=>text.length*7.4+10;
const intersects=(a:Rect,b:Rect,margin=0)=>Math.abs(a.x-b.x)<(a.width+b.width)/2+margin&&Math.abs(a.y-b.y)<(a.height+b.height)/2+margin;

/**
 * Connection label positions that never sit on a box or on another label.
 * Three or more arrows fanning from (or into) one box with the same wording carry a single shared label.
 * A null entry means the label is represented by a sibling arrow's label.
 */
export function placeEdgeLabels(boxes:readonly ConceptNodeBox[],edges:readonly LabelledEdge[],routes?:Map<number,ConceptRoute>){
  const byId=new Map(boxes.map(box=>[box.id,box])),placed:Rect[]=[],result=new Map<string,{x:number;y:number}|null>();
  // The canvas grows to fit labels, but a label should not wander far from the drawing.
  const frame={left:Math.min(...boxes.map(box=>box.x-box.width/2))-90,right:Math.max(...boxes.map(box=>box.x+box.width/2))+90,top:Math.min(...boxes.map(box=>box.y-box.height/2))-30,bottom:Math.max(...boxes.map(box=>box.y+box.height/2))+30};
  const text=(edge:LabelledEdge)=>edge.label?.trim()??'';
  const shared=new Set<string>();
  for(const end of ['source','target'] as const){
    const groups=new Map<string,LabelledEdge[]>();
    for(const edge of edges)if(text(edge)&&!shared.has(edge.id)){const key=`${edge[end]}\u0000${text(edge)}`;groups.set(key,[...(groups.get(key)??[]),edge]);}
    // Two labels fit side by side; three or more repeated labels crowd the gap between rows.
    for(const group of groups.values())if(group.length>2){
      // Keep the label on the middle arrow of the fan, ordered left to right.
      const ordered=[...group].sort((a,b)=>byId.get(end==='source'?a.target:a.source)!.x-byId.get(end==='source'?b.target:b.source)!.x);
      const keep=ordered[Math.floor((ordered.length-1)/2)];
      for(const edge of ordered)if(edge!==keep){shared.add(edge.id);result.set(edge.id,null);}
    }
  }
  for(const edge of edges){
    if(result.has(edge.id))continue;
    const a=byId.get(edge.source),b=byId.get(edge.target);
    if(!a||!b||!text(edge)){result.set(edge.id,null);continue;}
    const line=conceptConnection(a,b),width=labelWidth(text(edge));
    const route=routes?.get(edges.indexOf(edge));
    const along=route?conceptRouteSamples(route,LABEL_STEPS):LABEL_STEPS.map(t=>({x:line.x1+(line.x2-line.x1)*t,y:line.y1+(line.y2-line.y1)*t}));
    // On the connection first; then beside it (left, right), so crowded gaps still find a free spot.
    const beside=width/2+8;
    const candidates=[0,-beside,beside].flatMap(dx=>along.map(point=>({x:point.x+dx,y:point.y,width,height:LABEL_HEIGHT})));
    // Far outside the drawing is worse than touching a neighbour.
    const outside=(rect:Rect)=>rect.x-rect.width/2<frame.left||rect.x+rect.width/2>frame.right||rect.y-rect.height/2<frame.top||rect.y+rect.height/2>frame.bottom;
    const cost=(rect:Rect)=>boxes.filter(box=>intersects(rect,box,LABEL_MARGIN)).length*2+placed.filter(other=>intersects(rect,other,LABEL_MARGIN)).length+(outside(rect)?3:0);
    const best=candidates.find(rect=>cost(rect)===0)??candidates.reduce((low,rect)=>cost(rect)<cost(low)?rect:low);
    placed.push(best);result.set(edge.id,{x:best.x,y:best.y});
  }
  return result;
}

/** Canvas that contains every box and every placed label, for the diagram's viewBox. */
export function conceptCanvas(layout:{width:number;height:number},edges:readonly LabelledEdge[],labels:Map<string,{x:number;y:number}|null>){
  let left=0,top=0,right=layout.width,bottom=layout.height;
  for(const edge of edges){const at=labels.get(edge.id),text=edge.label?.trim();if(!at||!text)continue;const half=labelWidth(text)/2+8;left=Math.min(left,at.x-half);right=Math.max(right,at.x+half);top=Math.min(top,at.y-LABEL_HEIGHT);bottom=Math.max(bottom,at.y+LABEL_HEIGHT);}
  return {x:left,y:top,width:right-left,height:bottom-top};
}
