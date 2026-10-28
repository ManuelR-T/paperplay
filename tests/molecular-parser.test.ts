import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parsePdbCoordinates,type MoleculeParseRequest} from '../lib/molecules/parser';
import {validateMolecularGeometry} from '../shared/molecular-geometry';
import {hasCheckedAssetIntegrity} from '../lib/assets/local';
const base={format:'pdb' as const,id:'coordinates',label:'Explicit coordinates',attribution:'Authored test coordinates',rights:'Test fixture'};
export function atom(serial=1,options:{alt?:string;name?:string;x?:number;residue?:number;element?:string}={}){const a=Array(80).fill(' ');const put=(start:number,value:string)=>{for(let i=0;i<value.length;i++)a[start+i]=value[i];};put(0,'ATOM  ');put(6,String(serial).padStart(5));put(12,options.name??' CA ');put(16,options.alt??' ');put(17,'GLY');put(21,'A');put(22,String(options.residue??1).padStart(4));put(30,(options.x??serial).toFixed(3).padStart(8));put(38,'   0.000');put(46,'   0.000');put(54,'  1.00');put(60,' 20.00');put(76,options.element??' C');return a.join('');}
const req=(text:string):MoleculeParseRequest=>({...base,text});
test('genuine CC0 1CRN source preserves exact hash, fixed fields, TER and only three explicit CONECT pairs',async()=>{
 const text=await readFile(new URL('../public/structures/1CRN.pdb',import.meta.url),'utf8'),r=await parsePdbCoordinates({...req(text),expectedSha256:'42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811',classification:'experimental',scalarField:{kind:'b-factor',unit:'angstrom-squared'}});assert.equal(r.status,'ready');if(r.status!=='ready')return;
 assert.equal(hasCheckedAssetIntegrity(r.asset),true);const m=validateMolecularGeometry(r.asset);assert.equal(m.atoms.length,327);assert.equal(m.residues.length,46);assert.equal(m.models.length,1);assert.equal(m.models[0].implicit,true);assert.equal(m.models[0].rawSerial,'');assert.equal(m.connections.length,3);assert.equal(m.terminators.length,1);assert.deepEqual(m.connections.map(e=>e.recordIds.length),[2,2,2]);
 const a=m.atoms[0];assert.equal(a.line,276);assert.equal(a.rawName,' N  ');assert.equal(a.rawSerial,'    1');assert.equal(a.rawElement,' N');assert.deepEqual(a.sourceCoordinates,[17.047,14.099,3.625]);assert.deepEqual(r.asset.data.vertices[0],[17.047*.1,14.099*.1,3.625*.1]);assert.equal(m.atoms[1].rawElement,' C');assert.equal(m.source.byteLength,49491);assert.equal(r.asset.data.faces.length,0);
});
test('exact original newline bytes bind identity while absent scalar stays unknown/null',async()=>{
 let text=atom();text=text.slice(0,54)+'            '+text.slice(66);const a=await parsePdbCoordinates(req(text+'\n')),b=await parsePdbCoordinates(req(text+'\r\n'));assert.equal(a.status,'ready');assert.equal(b.status,'ready');if(a.status!=='ready'||b.status!=='ready')return;
 assert.notEqual(a.sourceSha256,b.sourceSha256);assert.equal(a.sourceSha256,createHash('sha256').update(text+'\n').digest('hex'));const m=validateMolecularGeometry(a.asset);assert.deepEqual(m.scalarField,{kind:'unknown'});assert.equal(m.classification,'unknown');assert.equal(m.atoms[0].temperatureFactor,null);assert.equal(m.atoms[0].occupancy,null);
});
test('models and alternate locations remain separate source sites without averaging',async()=>{
 const text=['MODEL        1',atom(1,{alt:'A',x:1}),atom(2,{alt:'B',x:3}),'ENDMDL','MODEL        2',atom(1,{x:7}),'ENDMDL'].join('\n');const r=await parsePdbCoordinates(req(text));assert.equal(r.status,'ready');if(r.status!=='ready')return;const m=validateMolecularGeometry(r.asset);assert.equal(m.models.length,2);assert.equal(m.atoms.length,3);assert.equal(m.residues.length,2);assert.deepEqual(m.atoms.map(a=>a.sourceCoordinates[0]),[1,3,7]);assert.equal(m.models[0].rawSerial,'   1');assert.notEqual(m.atoms[0].modelId,m.atoms[2].modelId);
});
test('malformed identity, dangling connectivity, ambiguous models, unsupported format and false confidence declarations fail explicitly',async()=>{
 const cases:[string,Partial<MoleculeParseRequest>,string][]=[
 [atom().slice(0,77),{},'short-atom'],[atom().slice(0,6)+'A0001'+atom().slice(11),{},'integer-field'],[atom().slice(0,30)+' 1.00e+0'+atom().slice(38),{},'numeric-field'],[atom()+'\n'+atom(1,{name:' N  '}),{},'duplicate-serial'],[atom()+'\n'+atom(2),{},'duplicate-site'],[atom()+'\nCONECT    1    9',{},'connection-endpoint'],[atom()+'\nCONECT    1 2',{},'connection-field'],[atom(1,{alt:'A'})+'\n'+atom(2,{alt:'B'})+'\nCONECT    1    2',{},'connection-conformer'],['MODEL        1\n'+atom(),{},'model-boundary'],['data_test\n_atom_site.id 1',{},'unsupported-format'],[atom()+'\t',{},'encoding'],[atom(),{expectedSha256:'0'.repeat(64)},'source-digest'],[atom(),{scalarField:{kind:'plddt',unit:'score-0-100',declaration:'Explicit user declaration'}},'invalid-pdb'],
 [['MODEL        1',atom(),'ENDMDL','MODEL        2',atom(),'ENDMDL','CONECT    1    2'].join('\n'),{},'ambiguous-connections']
 ];for(const [text,extra,code]of cases){const r=await parsePdbCoordinates({...req(text),...extra});assert.notEqual(r.status,'ready',code);if(r.status!=='ready')assert.equal(r.code,code);}
});
test('budgets and pre-cancellation reject before admitting oversized or excessive coordinates',async()=>{
 for(const text of ['X'.repeat(262145),'\n'.repeat(10001),'X'.repeat(4097),Array.from({length:513},(_,i)=>atom(i+1,{residue:Math.floor(i/3)+1,name:[' N  ',' CA ',' C  '][i%3]})).join('\n')]){const r=await parsePdbCoordinates(req(text));assert.equal(r.status,'limit-reached');}
 const controller=new AbortController();controller.abort();const r=await parsePdbCoordinates(req(atom()),{signal:controller.signal});assert.equal(r.status,'cancelled');
});

test('each semantic metadata budget bounds its own cardinality and declared confidence never comes from numeric range',async()=>{
 const chains=Array.from({length:9},(_,i)=>{const row=atom(i+1,{residue:i+1});return row.slice(0,21)+String.fromCharCode(65+i)+row.slice(22);}).join('\n');
 const residues=Array.from({length:257},(_,i)=>atom(i+1,{residue:i+1})).join('\n');
 const models=Array.from({length:5},(_,i)=>['MODEL     '+String(i+1).padStart(4),atom(),'ENDMDL'].join('\n')).join('\n');
 for(const text of [chains,residues,models])assert.equal((await parsePdbCoordinates(req(text))).status,'limit-reached');
 const declared=await parsePdbCoordinates({...req(atom()),classification:'predicted',scalarField:{kind:'plddt',unit:'score-0-100',declaration:'Explicitly supplied predicted confidence.'}});assert.equal(declared.status,'ready');if(declared.status==='ready')assert.equal(validateMolecularGeometry(declared.asset).scalarField.kind,'plddt');
});
