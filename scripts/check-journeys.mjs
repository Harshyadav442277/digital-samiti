import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://localhost:3017';
if (!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)) throw new Error('Use a local preview only.');
let cookie = '';
async function request(body, expected = 200) {
  const response = await fetch(origin + '/api/samiti', {
    method: body ? 'POST' : 'GET',
    headers: {cookie, Origin:origin, 'Content-Type':'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  });
  const next = response.headers.getSetCookie().find(c => c.startsWith('samiti_demo='));
  if (next) cookie = next.split(';')[0];
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
let state = await request({action:'start-demo'});
assert.equal(state.groups.length,0);
state = await request({action:'bootstrap'});
assert.equal(state.groups.length,0);
state = await request({action:'create', requestId:crypto.randomUUID(), name:'My first circle', monthly:100, target:1000, rate:6, months:6, threshold:60, visibility:'private', color:'peach', icon:'users', rules:''});
const group = state.groups[0];
assert.equal(group.members[0].saved,0);
assert.equal(group.activity.length,0);
assert.equal(group.guestOnly,true);
const payment = {action:'contribute',requestId:crypto.randomUUID(),groupId:group.id};
state = await request(payment);
assert.equal(state.groups[0].members[0].saved,100);
await request(payment);
await request({...payment, requestId:crypto.randomUUID()},400);
const restored = await request();
assert.equal(restored.groups[0].members[0].saved,100);
assert.equal(restored.groups[0].activity.length,1);
state = await request({action:'start-demo'});
assert.equal(state.groups.length,0);
console.log('PASS: empty demo startup, no automatic seeding, private group creation at zero, contribution/reload, duplicate protection, and fresh demo isolation.');
