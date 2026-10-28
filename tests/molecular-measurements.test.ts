import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdbCoordinates,type MolecularAsset} from '../lib/molecules/parser';
import {measureAtomDistance} from '../lib/molecules/measurements';
import {validateMolecularGeometry} from '../shared/molecular-geometry';
const request={format:'pdb' as const,id:'distance',label:'Coordinate distance',attribution:'CC0 RCSB PDB 1CRN',rights:'CC0'};
async function asset(text?:string):Promise<MolecularAsset>{const r=await parsePdbCoordinates({...request,text:text??await readFile(new URL('../public/structures/1CRN.pdb',import.meta.url),'utf8')});assert.equal(r.status,'ready');if(r.status!=='ready')throw Error();return r.asset;}
test('genuine source N–CA distance matches independently calculated rational squared distance, not camera geometry',async()=>{
 const a=await asset(),m=validateMolecularGeometry(a),r=measureAtomDistance(a,m.atoms[0].id,m.atoms[1].id);assert.ok(Math.abs(r.distanceAngstrom-1.4979966622125698)<1e-14);assert.ok(Math.abs(r.distanceAngstrom**2-2.243994)<1e-13);assert.ok(Math.abs(r.distanceNm-.14979966622125698)<1e-15);assert.equal(r.frame,m.frame);assert.deepEqual(r.atomIds,[m.atoms[0].id,m.atoms[1].id]);assert.equal(measureAtomDistance(a,m.atoms[1].id,m.atoms[0].id).distanceNm,r.distanceNm);assert.equal(measureAtomDistance(a,m.atoms[0].id,m.atoms[0].id).distanceNm,0);
 const original=await readFile(new URL('../public/structures/1CRN.pdb',import.meta.url),'utf8');const rows=original.split('\n').filter(x=>x.startsWith('ATOM  ')).slice(0,2);const rotated=rows.map(row=>{const x=Number(row.slice(30,38)),y=Number(row.slice(38,46)),z=Number(row.slice(46,54));return row.slice(0,30)+[-y+10,x-7,z+3].map(v=>v.toFixed(3).padStart(8)).join('')+row.slice(54);}).join('\n'),b=await asset(rotated),bm=validateMolecularGeometry(b);assert.ok(Math.abs(measureAtomDistance(b,bm.atoms[0].id,bm.atoms[1].id).distanceNm-r.distanceNm)<1e-14);
});
test('unadmitted clone, missing atom, wrong frame, cross-model and incompatible conformer distances reject',async()=>{
 const a=await asset(),m=validateMolecularGeometry(a),[first,second]=m.atoms;
 assert.throws(()=>measureAtomDistance(structuredClone(a),first.id,second.id),/integrity/);assert.throws(()=>measureAtomDistance(a,first.id,'absent'),/exact original/);assert.throws(()=>measureAtomDistance(a,first.id,second.id,{frame:'other'}),/exact original/);
 const original=await readFile(new URL('../public/structures/1CRN.pdb',import.meta.url),'utf8'),row=original.split('\n').find(x=>x.startsWith('ATOM  '))!;const alt=(id:number,loc:string)=>row.slice(0,6)+String(id).padStart(5)+row.slice(11,16)+loc+row.slice(17);
 const b=await asset([alt(1,'A'),alt(2,'B')].join('\n')),bm=validateMolecularGeometry(b);assert.throws(()=>measureAtomDistance(b,bm.atoms[0].id,bm.atoms[1].id),/alternate-location/);
 const c=await asset(['MODEL        1',row,'ENDMDL','MODEL        2',row,'ENDMDL'].join('\n')),cm=validateMolecularGeometry(c);assert.throws(()=>measureAtomDistance(c,cm.atoms[0].id,cm.atoms[1].id),/exact original/);
});
