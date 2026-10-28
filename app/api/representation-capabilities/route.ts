import { getRepresentationCapabilities, representationRegistry } from '@/lib/representations/adapters';
export function GET(request:Request){
 try{
   const url=new URL(request.url);if(url.search.length>4096)return Response.json({error:'Capability filters exceed 4 KiB.'},{status:413});
   const allowed=['behavior','data','interaction','bytes','evidence'];if([...url.searchParams.keys()].some(key=>!allowed.includes(key)))return Response.json({error:'Unknown capability filter.'},{status:400});
   const catalog=getRepresentationCapabilities();
   if(!url.searchParams.size)return Response.json(catalog,{headers:{'Cache-Control':'public, max-age=300'}});
   const size=url.searchParams.get('bytes')??'0';if(!/^\d{1,8}$/.test(size))throw Error('Invalid input size.');
   const selected=representationRegistry.select({behaviors:url.searchParams.getAll('behavior'),assetKinds:url.searchParams.getAll('data'),interactions:url.searchParams.getAll('interaction'),inputBytes:Number(size),requestedEvidence:url.searchParams.get('evidence')??'illustration'} as Parameters<typeof representationRegistry.select>[0]);
   return Response.json({format:catalog.format,schemaVersion:catalog.schemaVersion,...selected,policy:catalog.policy},{headers:{'Cache-Control':'public, max-age=300'}});
 }catch{return Response.json({error:'Invalid capability filters; use declared behavior, data and interaction IDs.'},{status:400});}
}
