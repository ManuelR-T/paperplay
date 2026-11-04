import * as cheerio from 'cheerio';

/** Static SVG image bytes only: never mounted as document markup. */
export function originalSvgImage(markup:string):string|undefined{
 if(markup.length>256_000)return;
 const $=cheerio.load(markup,{xmlMode:true});
 const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','clippath','mask','lineargradient','radialgradient','stop','use','symbol','title','desc','foreignobject','span']);
 $('*').each((_,element)=>{
  if(!('tagName' in element))return;
  const node=$(element),tag=element.tagName.toLowerCase();
  if(!allowed.has(tag)){node.remove();return;}
  for(const [name,value] of Object.entries(element.attribs)){
   if(/^on/i.test(name)||/^(?:href|xlink:href)$/i.test(name)&&!value.startsWith('#')||/url\(\s*['"]?(?!#)/i.test(value)||/javascript:|@import|expression\(/i.test(value))node.removeAttr(name);
  }
 });
 const svg=$('svg').first();
 if(!svg.length)return;
 svg.attr('xmlns','http://www.w3.org/2000/svg');
 svg.find('foreignObject span').attr('xmlns','http://www.w3.org/1999/xhtml');
 return $.xml(svg);
}
