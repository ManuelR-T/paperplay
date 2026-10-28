import { z } from 'zod';
import { name, text } from './widget-primitives';
import { molecularGeometryDataSchema,validateMolecularGeometry } from './molecular-geometry';
export const MAX_ASSET_FILE_BYTES=2*1024*1024;
export const MAX_ASSET_VALUES=32768;
const finite=z.number().finite();
const cell=z.union([finite,z.string().max(500),z.null()]);
const point=z.tuple([finite,finite,finite]);
const base={format:z.literal('paperplay-scientific-asset'),schemaVersion:z.literal(1),id:name,label:text.max(200),shape:z.array(z.number().int().min(0).max(10000)).max(8),
  coordinates:z.strictObject({system:text.max(300),axes:z.array(z.strictObject({label:text.max(80),unit:text.max(80),direction:z.enum(['increasing','decreasing','unspecified'])})).max(8)}),
  missingValues:z.enum(['null','reject']),
  provenance:z.strictObject({origin:z.enum(['user-supplied','source-extracted','illustrative']),attribution:text.max(1000),rights:text.max(1000),source:z.strictObject({documentId:z.string().min(1).max(100),sourceVersion:z.string().min(1).max(100),blockId:z.string().min(1).max(100),quote:text.max(1000)}).optional(),fileDigest:z.string().regex(/^[a-f0-9]{64}$/).optional()}),
  transformations:z.array(z.strictObject({name:text.max(100),description:text.max(500)})).max(16),
  checksum:z.strictObject({algorithm:z.literal('sha256'),scope:z.literal('manifest-and-data'),value:z.string().regex(/^[a-f0-9]{64}$/)}),
};
export const scientificAssetSchema=z.discriminatedUnion('kind',[
  z.strictObject({...base,kind:z.literal('table'),data:z.strictObject({columns:z.array(z.strictObject({id:name,label:text.max(120),type:z.enum(['number','text']),unit:text.max(80),temperatureMode:z.enum(['absolute','difference']).optional()})).min(1).max(32),rows:z.array(z.strictObject({id:name,values:z.array(cell).max(32)})).max(1000)})}),
  z.strictObject({...base,kind:z.literal('tensor'),data:z.strictObject({values:z.array(z.union([finite,z.null()])).max(MAX_ASSET_VALUES)})}),
  z.strictObject({...base,kind:z.literal('image'),data:z.strictObject({blockId:z.string().min(1).max(100),url:z.string().max(2000).optional(),alt:text.max(1000)})}),
  z.strictObject({...base,kind:z.literal('sequence'),data:z.strictObject({alphabet:z.enum(['dna','rna','protein','custom']),symbols:z.string().regex(/^[A-Za-z*.-]*$/).max(MAX_ASSET_VALUES)})}),
  z.strictObject({...base,kind:z.literal('graph'),data:z.strictObject({directed:z.boolean(),nodes:z.array(z.strictObject({id:name,label:text.max(120)})).max(1000),edges:z.array(z.strictObject({source:name,target:name,weight:finite.optional()})).max(5000)})}),
  z.strictObject({...base,kind:z.literal('geometry'),data:z.strictObject({vertices:z.array(point).max(10000),faces:z.array(z.tuple([z.number().int().nonnegative(),z.number().int().nonnegative(),z.number().int().nonnegative()])).max(10000),molecular:molecularGeometryDataSchema.optional()})}),
]);
export type ScientificAsset=z.infer<typeof scientificAssetSchema>;
export function validateAssetStructure(input:unknown):ScientificAsset {
  if(input&&typeof input==='object'&&'kind'in input&&input.kind==='geometry'&&'data'in input&&input.data&&typeof input.data==='object'&&'molecular'in input.data&&input.data.molecular!==undefined)validateMolecularGeometry(input);
  const asset=scientificAssetSchema.parse(input);
  // Molecular vertices have storage shape [sites,3], but three physical Cartesian axes.
  // The strict specialization below validates all three axes and source-coordinate binding.
  const molecular=asset.kind==='geometry'&&!!asset.data.molecular;
  if(asset.coordinates.axes.length&&asset.shape.length&&asset.coordinates.axes.length!==asset.shape.length&&!molecular)throw Error('Coordinate axes must match the declared rank.');
  const shape=(expected:number[])=>{if(JSON.stringify(asset.shape)!==JSON.stringify(expected))throw Error('Asset shape does not match its data.');};
  if(asset.kind==='table'){
    shape([asset.data.rows.length,asset.data.columns.length]);
    if(new Set(asset.data.columns.map(column=>column.id)).size!==asset.data.columns.length||new Set(asset.data.rows.map(row=>row.id)).size!==asset.data.rows.length)throw Error('Asset row/column identifiers must be unique.');
    for(const row of asset.data.rows){if(row.values.length!==asset.data.columns.length)throw Error('Table rows must match the column shape.');row.values.forEach((value,index)=>{if(value===null){if(asset.missingValues==='reject')throw Error('Missing values are forbidden by this asset policy.');}else if(typeof value!==asset.data.columns[index].type.replace('text','string'))throw Error('Table cell type does not match its column.');});}
  }
  if(asset.kind==='tensor'){if(!asset.shape.length||asset.shape.reduce((a,b)=>a*b,1)>MAX_ASSET_VALUES||asset.shape.reduce((a,b)=>a*b,1)!==asset.data.values.length)throw Error('Tensor shape does not match its bounded flattened values.');if(asset.missingValues==='reject'&&asset.data.values.includes(null))throw Error('Missing tensor values are forbidden.');}
  if(asset.kind==='sequence'){shape([asset.data.symbols.length]);const alphabets={dna:/^[ACGTRYSWKMBDHVN.-]*$/i,rna:/^[ACGURYSWKMBDHVN.-]*$/i,protein:/^[A-Z*.-]*$/i,custom:/./s};if(asset.data.symbols&&!alphabets[asset.data.alphabet].test(asset.data.symbols))throw Error('Sequence symbols do not match its declared alphabet.');}
  if(asset.kind==='graph'){shape([asset.data.nodes.length,asset.data.edges.length]);const ids=new Set(asset.data.nodes.map(node=>node.id));if(ids.size!==asset.data.nodes.length||asset.data.edges.some(edge=>!ids.has(edge.source)||!ids.has(edge.target)))throw Error('Graph identifiers or edge endpoints are invalid.');}
  if(asset.kind==='geometry'){shape([asset.data.vertices.length,3]);if(asset.data.faces.some(face=>face.some(index=>index>=asset.data.vertices.length)))throw Error('Geometry face refers to an unavailable vertex.');if(asset.data.molecular)validateMolecularGeometry(asset);}
  if(asset.kind==='image'){
    if(asset.shape.length!==0&&asset.shape.length!==2)throw Error('Image dimensions must be unknown or height × width.');
    if(asset.data.url&&!/^https?:\/\//.test(asset.data.url)&&!/^\/(?!\/)/.test(asset.data.url))throw Error('Image references use HTTP(S) or a same-origin path; they are not fetch permissions.');
    if(!asset.provenance.source||asset.provenance.source.blockId!==asset.data.blockId)throw Error('An original image reference requires its exact source passage.');
  }
  return asset;
}
