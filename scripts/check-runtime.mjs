import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin=process.argv[2] || 'http://localhost:3017';
async function get(cookie='',extra={}){const r=await fetch(origin+'/api/samiti',{headers:{cookie,...extra}});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return {data,cookie:r.headers.getSetCookie().find(c=>c.startsWith('samiti_demo='))?.split(';')[0]||cookie};}
async function post(cookie,action,values={},status=200){const r=await fetch(origin+'/api/samiti',{method:'POST',headers:{cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID(),...values})});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
const a=await get();assert.match(a.cookie,/samiti_demo=[a-f0-9]{64}/);assert.equal(a.data.groups.length,0);
let state=await post(a.cookie,'bootstrap');assert.equal(state.groups.length,3);const id=state.groups[0].id;
state=await post(a.cookie,'contribute',{groupId:id});assert.equal(state.groups[0].members[0].saved,7000);
await post(a.cookie,'contribute',{groupId:id},400);assert.equal((await get(a.cookie)).data.groups[0].members[0].saved,7000);
const b=await get();await post(b.cookie,'contribute',{groupId:id},403);
assert.notEqual((await get(b.cookie,{'oai-authenticated-user-id':state.user.id,'oai-authenticated-user-email':'test@example.invalid'})).data.user.id,state.user.id);
const loan=state.groups[0].loans[0];state=await post(a.cookie,'vote',{groupId:id,loanId:loan.id,approve:true});assert.equal(state.groups[0].loans[0].voteAudit.length,1);
state=await post(a.cookie,'autopay',{groupId:id,operation:'enable',day:10,consent:true});assert.equal(state.groups[0].autoPay[state.user.id].status,'active');
await post(a.cookie,'autopay',{groupId:id,operation:'cancel'});
await post(a.cookie,'create',{},401);
assert.equal((await fetch(origin+'/api/autopay/run')).status,401);
const env=await readFile('.env.local','utf8');const secret=JSON.parse(env.split(/\r?\n/).find(l=>l.startsWith('CRON_SECRET=')).slice('CRON_SECRET='.length));
const cron=await fetch(origin+'/api/autopay/run',{headers:{Authorization:`Bearer ${secret}`}});assert.equal(cron.status,200);assert.equal((await cron.json()).mode,'demo');
const session=await fetch(origin+'/api/auth/get-session');assert.equal(session.status,200);
console.log('PASS: persistent groups, contribution/reload, duplicate protection, isolated sessions, spoofed-header rejection, vote audit, Auto Pay lifecycle, sign-in requirement, protected cron, and auth session endpoint.');
