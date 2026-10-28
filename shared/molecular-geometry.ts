import { z } from 'zod';
import { name,text } from './widget-primitives';

export const MOLECULAR_GEOMETRY_VERSION='1.0.0';
export const MOLECULAR_LIMITS=Object.freeze({maxInputBytes:256*1024,maxLines:10000,maxLineLength:4096,maxAtoms:512,maxResidues:256,maxModels:4,maxChains:8,maxConnections:1024});
const ascii=(width:number)=>z.string().length(width).regex(/^[\x20-\x7e]*$/);
const sha=z.string().regex(/^[a-f0-9]{64}$/),entityId=z.string().min(1).max(100),recordId=z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),finite=z.number().finite(),point=z.tuple([finite,finite,finite]),character=ascii(1);
export const molecularModelSchema=z.strictObject({id:entityId,recordId,rawSerial:z.string().max(4).regex(/^[\x20-\x7e]*$/),implicit:z.boolean()});
export const molecularResidueSchema=z.strictObject({id:entityId,recordId,modelId:entityId,chainId:character,rawName:ascii(3),rawSequence:ascii(4),insertionCode:character});
export const molecularAtomSchema=z.strictObject({id:entityId,recordId,line:z.number().int().min(1).max(10000),record:z.enum(['ATOM','HETATM']),modelId:entityId,residueId:entityId,rawSerial:ascii(5),rawName:ascii(4),rawElement:ascii(2),altLoc:character,sourceCoordinates:point,vertexIndex:z.number().int().min(0).max(511),occupancy:finite.min(0).max(1).nullable(),temperatureFactor:finite.nullable()});
export const molecularConnectionSchema=z.strictObject({id:entityId,atomIds:z.tuple([entityId,entityId]),recordIds:z.array(recordId).min(1).max(8),kind:z.literal('source-declared'),order:z.literal('unknown')});
export const molecularTerminatorSchema=z.strictObject({modelId:entityId,recordId,line:z.number().int().min(1).max(10000),rawLine:z.string().min(27).max(80).regex(/^[\x20-\x7e]*$/)});
export const molecularGeometryDataSchema=z.strictObject({format:z.literal('paperplay-molecular-geometry'),schemaVersion:z.literal(1),source:z.strictObject({format:z.literal('pdb'),sha256:sha,byteLength:z.number().int().min(1).max(256*1024),entryId:z.string().min(1).max(40).optional()}),frame:name,originalUnit:z.literal('angstrom'),normalizedUnit:z.literal('nm'),classification:z.enum(['experimental','predicted','unknown']),scalarField:z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('unknown')}),z.strictObject({kind:z.literal('b-factor'),unit:z.literal('angstrom-squared')}),z.strictObject({kind:z.literal('plddt'),unit:z.literal('score-0-100'),declaration:z.string().trim().min(12).max(500)})]),models:z.array(molecularModelSchema).min(1).max(4),residues:z.array(molecularResidueSchema).min(1).max(256),atoms:z.array(molecularAtomSchema).min(1).max(512),connections:z.array(molecularConnectionSchema).max(1024),terminators:z.array(molecularTerminatorSchema).max(512)});
export type MolecularGeometryData=z.infer<typeof molecularGeometryDataSchema>;
export type MolecularAtom=z.infer<typeof molecularAtomSchema>;
export type MolecularResidue=z.infer<typeof molecularResidueSchema>;
export type MolecularModel=z.infer<typeof molecularModelSchema>;
export function molecularEntityId(kind:'atom'|'residue'|'model'|'connection',sourceSha256:string,sourceRecordId:string){sha.parse(sourceSha256);recordId.parse(sourceRecordId);return `${kind}-${sourceSha256}-${sourceRecordId}`;}
export function molecularConnectionId(sourceSha256:string,leftRecordId:string,rightRecordId:string){recordId.parse(leftRecordId);recordId.parse(rightRecordId);return molecularEntityId('connection',sourceSha256,[leftRecordId,rightRecordId].sort().join('_'));}
export function molecularFrameId(sourceSha256:string){sha.parse(sourceSha256);return `molecule-${sourceSha256.slice(0,24)}`;}
const unique=(values:string[],label:string)=>{if(new Set(values).size!==values.length)throw Error(`Duplicate molecular ${label}.`);};
/** Structural specialization only. Asset checksum/source integrity is still admitted by validateScientificAsset. */
export function validateMolecularGeometry(input:unknown):MolecularGeometryData{
 if(!input||typeof input!=='object'||!('kind'in input)||input.kind!=='geometry'||!('data'in input)||!input.data||typeof input.data!=='object')throw Error('Molecular coordinates require a geometry asset.');
 const data=input.data as {vertices?:unknown;faces?:unknown;molecular?:unknown};
 // Bound collections before Zod visits their elements; malformed huge arrays
 // must not allocate one validation error per supplied item on the host.
 if(data.molecular&&typeof data.molecular==='object')for(const [key,limit] of Object.entries({atoms:512,residues:256,models:4,connections:1024,terminators:512})){const value=(data.molecular as Record<string,unknown>)[key];if(Array.isArray(value)&&value.length>limit)throw Error(`Molecular ${key} budget exceeded.`);}
 if(Array.isArray(data.vertices)&&data.vertices.length>512||Array.isArray(data.faces)&&data.faces.length>0)throw Error('Molecular vertex/surface budget exceeded.');
 const m=molecularGeometryDataSchema.parse(data.molecular),vertices=z.array(point).parse(data.vertices),faces=z.array(z.tuple([z.number(),z.number(),z.number()])).parse(data.faces);
 if(vertices.length!==m.atoms.length||faces.length)throw Error('Molecular atom coordinates need one vertex per atom and no inferred surface faces.');
 if(!('shape'in input)||JSON.stringify(input.shape)!==JSON.stringify([vertices.length,3]))throw Error('Molecular geometry shape differs from its atom sites.');
 const coordinates='coordinates'in input?input.coordinates:undefined;
 if(!coordinates||typeof coordinates!=='object'||!('axes'in coordinates)||!Array.isArray(coordinates.axes)||coordinates.axes.length!==3||coordinates.axes.some(axis=>!axis||typeof axis!=='object'||!('unit'in axis)||axis.unit!=='nm'))throw Error('Molecular normalized coordinate axes must explicitly use nm.');
 if(m.frame!==molecularFrameId(m.source.sha256))throw Error('Molecular coordinate frame differs from its exact source bytes.');
 unique(m.models.map(item=>item.id),'model identifiers');unique(m.residues.map(item=>item.id),'residue identifiers');unique(m.atoms.map(item=>item.id),'atom identifiers');unique(m.connections.map(item=>item.id),'connection identifiers');
 unique(m.models.map(item=>item.recordId),'model records');unique(m.atoms.map(item=>item.recordId),'atom records');
 const models=new Map(m.models.map(item=>[item.id,item])),residues=new Map(m.residues.map(item=>[item.id,item])),atoms=new Map(m.atoms.map(item=>[item.id,item]));
 for(const model of m.models){if(model.id!==molecularEntityId('model',m.source.sha256,model.recordId)||model.implicit&&(m.models.length!==1||model.rawSerial!==''||model.recordId!=='implicit')||!model.implicit&&(!/^l[1-9][0-9]*$/.test(model.recordId)||model.rawSerial.length!==4||!/^\s*\d+\s*$/.test(model.rawSerial)||Number(model.rawSerial)<1))throw Error('Molecular model identity/serial differs from the original record.');}
 unique(m.models.map(model=>model.implicit?'implicit':String(Number(model.rawSerial))),'original model serials');
 if(new Set(m.residues.map(item=>item.chainId)).size>8)throw Error('Molecular chain budget exceeded.');
 for(const residue of m.residues){if(!models.has(residue.modelId)||residue.id!==molecularEntityId('residue',m.source.sha256,residue.recordId)||!/^\s*-?\d+\s*$/.test(residue.rawSequence)||!residue.rawName.trim())throw Error('Molecular residue identity/model/sequence is invalid.');}
 unique(m.residues.map(item=>JSON.stringify([item.modelId,item.chainId,Number(item.rawSequence),item.insertionCode,item.rawName])),'residue source tuples');
 const serials:string[]=[],tuples:string[]=[];
 for(const atom of m.atoms){const residue=residues.get(atom.residueId);if(atom.id!==molecularEntityId('atom',m.source.sha256,atom.recordId)||atom.recordId!==`l${atom.line}`||!models.has(atom.modelId)||!residue||residue.modelId!==atom.modelId||!/^\s*\d+\s*$/.test(atom.rawSerial)||!atom.rawName.trim()||!/^[A-Za-z]{1,2}$/.test(atom.rawElement.trim()))throw Error('Molecular atom source/model/residue identity is invalid.');
  if(atom.vertexIndex>=vertices.length||atom.vertexIndex!==m.atoms.indexOf(atom))throw Error('Molecular vertex order differs from its atom site order.');
  for(let axis=0;axis<3;axis++){const actual=vertices[atom.vertexIndex][axis],expected=atom.sourceCoordinates[axis]*.1;if(Math.abs(actual-expected)>32*Number.EPSILON*Math.max(Math.abs(actual),Math.abs(expected),Number.MIN_VALUE))throw Error('Molecular normalized nm vertex differs from the original angstrom coordinates.');}
  if(m.scalarField.kind==='b-factor'&&atom.temperatureFactor!==null&&atom.temperatureFactor<0||m.scalarField.kind==='plddt'&&atom.temperatureFactor!==null&&(atom.temperatureFactor<0||atom.temperatureFactor>100))throw Error('The declared molecular scalar interpretation is outside its valid range.');
  serials.push(JSON.stringify([atom.modelId,Number(atom.rawSerial)]));tuples.push(JSON.stringify([atom.modelId,residue.chainId,Number(residue.rawSequence),residue.insertionCode,residue.rawName,atom.rawName,atom.altLoc,atom.record]));
 }
 unique(serials,'serials within a model');unique(tuples,'atom source tuples');
 if(m.scalarField.kind==='plddt'&&m.classification!=='predicted')throw Error('Declared pLDDT needs explicitly predicted-model provenance.');
 for(const residue of m.residues){const members=m.atoms.filter(atom=>atom.residueId===residue.id);if(!members.length||residue.recordId!==`l${Math.min(...members.map(atom=>atom.line))}`)throw Error('A molecular residue must retain its first supplied atom record identity.');}
 for(const model of m.models)if(!m.atoms.some(atom=>atom.modelId===model.id))throw Error('A molecular model needs supplied atom coordinates.');
 const occupiedRecords=[...m.models.filter(model=>!model.implicit).map(model=>model.recordId),...m.atoms.map(atom=>atom.recordId),...m.terminators.map(terminal=>terminal.recordId)];unique(occupiedRecords,'coordinate/model/TER source records');
 const edgePairs:string[]=[];
 for(const edge of m.connections){const a=atoms.get(edge.atomIds[0]),b=atoms.get(edge.atomIds[1]);if(!a||!b||a.id===b.id||a.modelId!==b.modelId||edge.id!==molecularConnectionId(m.source.sha256,a.recordId,b.recordId)||edge.recordIds.some(id=>!/^l[1-9][0-9]*$/.test(id)||occupiedRecords.includes(id)))throw Error('Source-declared molecular connection has unavailable or cross-model endpoints.');edgePairs.push([...edge.atomIds].sort().join('|'));}
 unique(edgePairs,'source connection pairs');
 for(const terminal of m.terminators)if(!models.has(terminal.modelId)||terminal.recordId!==`l${terminal.line}`||!terminal.rawLine.startsWith('TER   '))throw Error('Molecular TER source record is invalid.');
 return m;
}
export const moleculeSettingsSchema=z.strictObject({projection:z.literal('orthographic'),rotation:z.tuple([finite.min(-180).max(180),finite.min(-180).max(180),finite.min(-180).max(180)]),zoom:finite.min(.25).max(4),clip:z.tuple([finite.min(-1).max(1),finite.min(-1).max(1)]),labels:z.enum(['selected','none']),connections:z.enum(['source-declared','none'])});
export type MoleculeSettings=z.infer<typeof moleculeSettingsSchema>;
export function createDefaultMoleculeSettings():MoleculeSettings{return {projection:'orthographic',rotation:[0,0,0],zoom:1,clip:[-1,1],labels:'selected',connections:'none'};}
export const moleculeViewSchema=z.strictObject({title:text.max(200),anchorIds:z.array(name).min(1).max(32),assetId:name,modelId:entityId,conformer:z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('all')}),z.strictObject({kind:z.literal('alt-loc'),id:character})]),settings:moleculeSettingsSchema});
export type MoleculeView=z.infer<typeof moleculeViewSchema>;
/** Shared-site blank altLoc plus an explicitly selected alternate; camera clipping is presentation only. */
export function activeMolecularAtoms(metadata:MolecularGeometryData,selection:Pick<MoleculeView,'modelId'|'conformer'>):MolecularAtom[]{if(!metadata.models.some(model=>model.id===selection.modelId))throw Error('The selected molecular model is unavailable.');const atoms=metadata.atoms.filter(atom=>atom.modelId===selection.modelId);if(selection.conformer.kind==='all')return atoms;const id=selection.conformer.id;if(!atoms.some(atom=>atom.altLoc===id))throw Error('The selected molecular alternate location is unavailable.');return atoms.filter(atom=>atom.altLoc===' '||atom.altLoc===id);}
export function validateMoleculeView(input:unknown,asset:unknown):MoleculeView{const view=moleculeViewSchema.parse(input),m=validateMolecularGeometry(asset);if(!asset||typeof asset!=='object'||!('id'in asset)||asset.id!==view.assetId||!activeMolecularAtoms(m,view).length||view.settings.clip[0]>=view.settings.clip[1])throw Error('Molecular view/model/conformer/clipping does not match its supplied structure.');return view;}
export const molecularDistanceSchema=z.strictObject({sourceSha256:sha,modelId:entityId,frame:name,atomIds:z.tuple([entityId,entityId]),distanceNm:finite.nonnegative(),distanceAngstrom:finite.nonnegative()});
export type MolecularDistance=z.infer<typeof molecularDistanceSchema>;
