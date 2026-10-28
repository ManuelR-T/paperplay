type SourceCopyEvent={currentTarget:HTMLElement;clipboardData:DataTransfer;preventDefault:()=>void};
const blockTags=new Set(['P','DIV','SECTION','ARTICLE','LI','H1','H2','H3','H4','H5','H6','FIGURE','FIGCAPTION','BLOCKQUOTE']);
function plainText(node:Node):string{
 if(node.nodeType===3)return node.nodeValue??'';
 const element=node.nodeType===1?node as Element:null;
 if(element?.tagName==='BR')return '\n';
 const text=Array.from(node.childNodes,plainText).join('');
 return element&&blockTags.has(element.tagName)?`\n${text}\n`:text;
}
function formulaFor(node:Node){return (node.nodeType===1?node as Element:node.parentElement)?.closest('[data-source-math]');}

/** Copy each selected formula once as its exact TeX, retaining hats, primes and scripts. Never mutate source or selection. */
export function copySourceMathSelection(event:SourceCopyEvent){
 const selection=event.currentTarget.ownerDocument.defaultView?.getSelection();
 if(!event.clipboardData||!selection||selection.rangeCount!==1||selection.isCollapsed)return;
 const original=selection.getRangeAt(0);
 if(!event.currentTarget.contains(original.commonAncestorContainer))return;
 const touched=Array.from(event.currentTarget.querySelectorAll('[data-source-math]')).some(node=>original.intersectsNode(node));
 if(!touched)return;
 const range=original.cloneRange(),first=formulaFor(range.startContainer),last=formulaFor(range.endContainer);
 // Formula fragments do not have an unambiguous independent source; copy the touched formula atomically.
 if(first)range.setStartBefore(first);
 if(last)range.setEndAfter(last);
 const fragment=range.cloneContents(),document=event.currentTarget.ownerDocument;
 fragment.querySelectorAll('[data-source-math]').forEach(node=>node.replaceWith(document.createTextNode(`\\(${node.getAttribute('data-source-math')}\\)`)));
 // A cross-paragraph selection can also include a standalone KaTeX equation.
 fragment.querySelectorAll('.katex').forEach(node=>{const latex=node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;if(latex)node.replaceWith(document.createTextNode(`\\(${latex}\\)`));});
 event.clipboardData.setData('text/plain',plainText(fragment).replace(/\n{3,}/g,'\n\n').trim());
 event.preventDefault();
}
