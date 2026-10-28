/** Reproducible engineering randomness, not a cryptographic or scientific RNG certification. */
export function deriveFigureSeed(seed:number,payload:string){
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('Figure seed must be a uint32.');
 let value=(0x811c9dc5^seed)>>>0;for(let i=0;i<payload.length;i++)value=Math.imul(value^payload.charCodeAt(i),0x01000193)>>>0;return value;
}
