import {parseArxivId,fetchArxivResource,parseArxivOriginalFigures} from '@/lib/import/arxiv';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const input=new URL(request.url).searchParams.get('id');
 let id:string;
 try{id=parseArxivId(input??'');if(!/v\d+$/.test(id))throw Error('An exact arXiv version is required.');}
 catch{return Response.json({error:'Provide a versioned arXiv ID.'},{status:400});}
 try{
  const resource=await fetchArxivResource(`https://arxiv.org/html/${id}`,2_000_000,fetch,request.signal);
  if(parseArxivId(resource.url)!==id)throw Error('The original article version changed.');
  const figures=parseArxivOriginalFigures(new TextDecoder('utf-8',{fatal:true}).decode(resource.bytes),id,resource.url);
  return Response.json({kind:'html',arxivId:id,figures},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Original source figures could not be retrieved.'},{status:502});}
}
