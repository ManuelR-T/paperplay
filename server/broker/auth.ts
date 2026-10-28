import {randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {AnalysisHttpError,requireSameOrigin,sessionFor} from '../analysis/security';
export function brokerSigningKey(options:{path?:string;secret?:string}={}){
 const override=options.secret??process.env.BROKER_SIGNING_SECRET;if(override){if(override.length<32)throw new AnalysisHttpError(503,'Broker signing configuration is unavailable.');return override;}
 const path=options.path??resolve(process.cwd(),'.paperplay/broker-session.key');
 try{mkdirSync(dirname(path),{recursive:true,mode:0o700});try{writeFileSync(path,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}const key=readFileSync(path,'utf8');if(!/^[a-f0-9]{64}$/.test(key)||(statSync(path).mode&0o077)!==0)throw Error();return key;}catch{throw new AnalysisHttpError(503,'The broker session key is unavailable; no job was started.');}
}
export function brokerSession(request:Request,key:string,now:number,create:boolean,origin?:string){requireSameOrigin(request,origin);return sessionFor(request,key,now,create,{cookieName:'paperplay_broker_session'});}
