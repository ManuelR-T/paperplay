/** Inspect structure before recursive operations; generated messages contain plain JSON only. */
export function assertBoundedFigureJson(input:unknown,maxBytes:number){
 const queue=[{value:input,depth:0}];let count=0;
 while(queue.length){const {value,depth}=queue.pop()!;if(++count>8192||depth>20)throw Error('Figure data exceeds structural limits.');if(value===null||typeof value==='string'||typeof value==='boolean')continue;if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Figure numbers must be finite.');continue;}if(!value||typeof value!=='object')throw Error('Figure data must be plain JSON.');if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('Figure data must be plain JSON.');for(const key of Object.keys(value)){if(key.length>200)throw Error('Figure keys exceed limits.');queue.push({value:(value as Record<string,unknown>)[key],depth:depth+1});}}
 if(new TextEncoder().encode(JSON.stringify(input)).length>maxBytes)throw Error('Figure data exceeds byte limits.');
}
/** Call after structure validation; parser-produced JSON cannot contain accessors or cycles. */
export function freezeFigureValue<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freezeFigureValue);Object.freeze(value);}return value;}
