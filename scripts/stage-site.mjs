import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root=process.cwd();const target=resolve(process.argv[2]??'.paperplay-sites');
if(target===root||!target.startsWith(root+'/'))throw Error('Use the isolated Site checkout inside this project.');
try{await access(join(target,'.openai','hosting.json'))}catch{throw Error('Open/register the Site first; its retained .openai/hosting.json must already exist.');}
let retainedIgnore='';try{retainedIgnore=await readFile(join(target,'.gitignore'),'utf8')}catch{}
for(const obsolete of ['worker','hooks','examples','db','drizzle','vendor','vite.config.ts','drizzle.config.ts','cloudflare-env.d.ts','eslint.config.mjs'])await rm(join(target,obsolete),{recursive:true,force:true});
const directories=['app','artifacts','components','data','deploy','docs','lib','public','server','shared','tests','.github'];
for(const directory of directories){
 try{await access(join(root,directory))}catch{continue;}
 await rm(join(target,directory),{recursive:true,force:true});await cp(join(root,directory),join(target,directory),{recursive:true});
}
// Merge authored scripts into retained Sites helpers instead of erasing the Sites plugin.
await mkdir(join(target,'scripts'),{recursive:true});
for(const entry of await readdir(join(root,'scripts'),{withFileTypes:true}))await cp(join(root,'scripts',entry.name),join(target,'scripts',entry.name),{recursive:true});
for(const file of ['README.md','LICENSE','THIRD_PARTY_NOTICES.txt','CONTRIBUTING.md','SECURITY.md','Dockerfile','compose.yml','.dockerignore','.env.example','.gitignore','.nvmrc','next.config.ts','postcss.config.mjs','tsconfig.json','components.json','package-lock.json','next-env.d.ts']){
 try{await access(join(root,file))}catch{continue;}await cp(join(root,file),join(target,file));
}
const rootIgnore=await readFile(join(root,'.gitignore'),'utf8');await writeFile(join(target,'.gitignore'),[...new Set((retainedIgnore+'\n'+rootIgnore+'\n.sites-runtime/\n.wrangler/\n').split('\n'))].join('\n')+'\n');
const tsconfig=JSON.parse(await readFile(join(target,'tsconfig.json'),'utf8'));tsconfig.exclude=[...new Set([...(tsconfig.exclude??[]),'scripts/vite/**'])];await writeFile(join(target,'tsconfig.json'),JSON.stringify(tsconfig,null,2)+'\n');
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
manifest.private=true;manifest.scripts={...manifest.scripts,'build:local':manifest.scripts.build,build:'node --import tsx scripts/build-hosted.ts'};
await writeFile(join(target,'package.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Staged authored Paperplay source and public assets. Retained Site identity/helpers were preserved; private env/runtime data were not copied.');
