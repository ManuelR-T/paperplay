import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionFor} from '../server/analysis/security';

const request=(cookie?:string)=>new Request('http://localhost/api/broker/status',{headers:cookie?{cookie}:{}});
const cookieHeader=(cookie:string)=>cookie.split(';')[0];
test('broker ownership cookies do not replace or authenticate existing analysis sessions',()=>{
 const analysis=sessionFor(request(),'analysis-test-secret',1000,true),broker=sessionFor(request(cookieHeader(analysis.cookie!)),'broker-test-secret',1000,true,{cookieName:'paperplay_broker_session'});
 assert.notEqual(broker.sid,analysis.sid);assert.match(analysis.cookie!,/^paperplay_session=/);assert.match(broker.cookie!,/^paperplay_broker_session=/);
 const cookies=`${cookieHeader(analysis.cookie!)}; ${cookieHeader(broker.cookie!)}`;
 assert.equal(sessionFor(request(cookies),'analysis-test-secret',1001,false).sid,analysis.sid);
 assert.equal(sessionFor(request(cookies),'broker-test-secret',1001,false,{cookieName:'paperplay_broker_session'}).sid,broker.sid);
 assert.throws(()=>sessionFor(request(cookieHeader(analysis.cookie!)),'broker-test-secret',1001,false,{cookieName:'paperplay_broker_session'}),/missing or expired/);
});
test('an invalid cookie namespace cannot alter response headers',()=>{
 assert.throws(()=>sessionFor(request(),'test-secret',1000,true,{cookieName:'invalid; Inject=value'}),/Invalid application session/);
});
