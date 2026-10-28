/** Guest-side helpers only; this text grants no host callbacks or ambient capabilities. */
export const FIGURE_SDK_SOURCE=`const sdk=Object.freeze({
 frame:function(spec){return Object.assign({format:'paperplay-sdk-frame',schemaVersion:1,marks:[],controls:[],table:{caption:'No numerical rows supplied',columns:['Value'],rows:[]}},spec);},
 circle:function(spec){return Object.assign({kind:'circle',paint:'accent'},spec);},
 line:function(spec){return Object.assign({kind:'line',paint:'muted'},spec);},
 rectangle:function(spec){return Object.assign({kind:'rectangle',paint:'accent'},spec);},
 text:function(spec){return Object.assign({kind:'text'},spec);},
 button:function(spec){return Object.assign({kind:'button',disabled:false},spec);},
 slider:function(spec){return Object.assign({kind:'slider'},spec);}
});`;
export async function sha256Text(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');}
