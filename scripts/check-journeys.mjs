import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://localhost:3017';
if (!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)) throw new Error('Use a local preview only.');
const first = await fetch(origin+'/api/samiti');
assert.equal(first.status,200);
const cookie = first.headers.getSetCookie().find(c=>c.startsWith('samiti_demo='))?.split(';')[0];
assert.ok(cookie);
async function post(action, values={}, status=200) {
  const response = await fetch(origin+'/api/samiti',{method:'POST',headers:{cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID(),...values})});
  const body = await response.json(); assert.equal(response.status,status,JSON.stringify(body)); return body;
}
let state = await post('bootstrap');
const groupId = state.groups[0].id;
state = await post('contribute',{groupId});
assert.equal(state.groups[0].activity[0].type,'contribution');
assert.equal(state.groups[0].activity[0].amount,1000);
await post('contribute',{groupId},400);
const loan = state.groups[1].loans[0];
const loanGroupId = state.groups[1].id;
for (let i=1;i<=loan.months;i++) {
  state = await post('repay',{groupId:loanGroupId,loanId:loan.id});
  const updated = state.groups[1].loans[0];
  assert.equal(updated.paidInstallments,i);
  assert.equal(updated.repaid,515*i);
  assert.equal(updated.status,i===loan.months?'repaid':'approved');
}
await post('repay',{groupId:loanGroupId,loanId:loan.id},400);
const voting = state.groups[0].loans[0];
state = await post('vote',{groupId,loanId:voting.id,approve:true});
assert.equal(state.groups[0].loans[0].voteAudit[0].memberId,state.user.id);
await post('vote',{groupId,loanId:voting.id,approve:false},400);
const reloaded = await (await fetch(origin+'/api/samiti',{headers:{cookie}})).json();
assert.equal(reloaded.groups[1].loans[0].status,'repaid');
assert.equal(reloaded.groups[0].members[0].saved,7000);
const outsider = await fetch(origin+'/api/samiti');
const otherCookie = outsider.headers.getSetCookie().find(c=>c.startsWith('samiti_demo='))?.split(';')[0];
const forbidden = await fetch(origin+'/api/samiti',{method:'POST',headers:{cookie:otherCookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'contribute',groupId,requestId:crypto.randomUUID()})});
assert.equal(forbidden.status,403);
console.log('PASS: persisted contribution receipt, duplicate protection, all six repayments, fully repaid state, final vote audit, reload, and membership checks. Only isolated demo sessions were changed; no scheduler or wallet calls.');
