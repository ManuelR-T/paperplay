/**
 * PCG-XSH-RR 64/32, ported from pcg_basic.c at
 * bc39cd76ac3d541e618606bcc6e1e5ba5e5e6aa3.
 * Copyright 2014 Melissa O'Neill <oneill@pcg-random.org>
 * SPDX-License-Identifier: Apache-2.0
 * Modified 2026 for TypeScript/BigInt, canonical strings and per-word budgeting.
 * Full license/modification notice: licenses/pcg-c-basic-LICENSE.txt and pcg32-NOTICE.txt.
 */
export {STOCHASTIC_PRNG_VERSION as PCG32_VERSION,STOCHASTIC_UNIFORM_VERSION} from '../../shared/stochastic';
const UINT64_MAX=(1n<<64n)-1n,UINT63_MAX=(1n<<63n)-1n;
export function parsePcgInteger(value:string,kind:'seed'|'sequence'='seed'):bigint{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(value))throw Error('Use a canonical nonnegative decimal PRNG integer.');const parsed=BigInt(value);if(parsed>(kind==='sequence'?UINT63_MAX:UINT64_MAX))throw Error('The PRNG integer exceeds its declared width.');return parsed;
}
/** The hook runs before every output, including the two initialization advances. */
export function createPcg32(seed:string,sequence:string,onWord?:()=>void){
 const initial=parsePcgInteger(seed),stream=parsePcgInteger(sequence,'sequence');let state=0n;const increment=(stream<<1n)|1n;
 function nextUint32(){onWord?.();const old=state;state=BigInt.asUintN(64,old*6364136223846793005n+increment);const x=Number(BigInt.asUintN(32,((old>>18n)^old)>>27n)),rotation=Number(old>>59n);return ((x>>>rotation)|(x<<((-rotation)&31)))>>>0;}
 nextUint32();state=BigInt.asUintN(64,state+initial);nextUint32();
 return {nextUint32,snapshot:()=>({state:state.toString(),sequence:stream.toString()})};
}
/** Paperplay's mapping: two words per attempt, reject zero; never produces 0 or 1. */
export function openUniform53(nextWord:()=>number):number{
 while(true){const first=nextWord(),second=nextWord();if(!Number.isInteger(first)||first<0||first>0xffffffff||!Number.isInteger(second)||second<0||second>0xffffffff)throw Error('A PRNG word must be uint32.');const integer=(first>>>5)*67108864+(second>>>6);if(integer!==0)return integer/9007199254740992;}
}
