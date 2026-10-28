import { build } from 'esbuild';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile,rename,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifactCompilerPlugin } from './artifact-compiler-plugin.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function writeAtomic(path,bytes){const temporary=`${path}.${randomUUID()}.tmp`;try{await writeFile(temporary,bytes);await rename(temporary,path);}finally{await rm(temporary,{force:true});}}
/** Build fixed trusted entries only. No generated source, model path or install/build hook enters esbuild. */
export async function buildArtifactInfrastructure({outputDirectory='public'}={}){
 const directory=resolve(outputDirectory);await mkdir(directory,{recursive:true});
 // Node 24's native type stripping loads this fixed trusted TS module. A content query avoids stale SDK exports in repeated builds.
 const sdkFile=resolve('lib/artifacts/sdk-source.ts'),sdkUrl=pathToFileURL(sdkFile);sdkUrl.searchParams.set('source',digest(await readFile(sdkFile)));
 const {FIGURE_SDK_SOURCE}=await import(sdkUrl.href);if(typeof FIGURE_SDK_SOURCE!=='string')throw Error('Trusted SDK source is unavailable.');
 const workers={};
 for(const kind of ['compiler','runtime']){
  const alias=`artifact-${kind}.worker.mjs`,result=await build({entryPoints:[resolve(`lib/artifacts/${kind}-worker.ts`)],outfile:join(directory,alias),write:false,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',tsconfig:resolve('tsconfig.json'),plugins:[artifactCompilerPlugin]});
  if(result.outputFiles.length!==1)throw Error('Unexpected infrastructure build outputs.');const bytes=result.outputFiles[0].contents,sha256=digest(bytes),filename=`artifact-${kind}.${sha256}.worker.mjs`,path=join(directory,filename);
  try{await writeFile(path,bytes,{flag:'wx'});}catch(error){if(error?.code!=='EEXIST')throw error;if(digest(await readFile(path))!==sha256)throw Error('An existing content-addressed worker has different bytes.');}
  await writeAtomic(join(directory,alias),bytes);workers[kind]={url:`/${filename}`,sha256};
 }
 const metadata={format:'paperplay-artifact-infrastructure',schemaVersion:1,sdkSha256:digest(FIGURE_SDK_SOURCE),workers};
 await writeAtomic(join(directory,'artifact-workers.json'),JSON.stringify(metadata,null,2)+'\n');return metadata;
}
