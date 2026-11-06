import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeDemo, monthKey, pool, round, groupSavings, loanTotal } from '../app/model';
import { remainingInstallments, projectGoal } from '../app/progress-model';
import { updateGroup } from '../app/domain';

test('the displayed installments match every actual repayment, including the final rounded amount', () => {
  const g = makeDemo('tester', 'Test Member')[1];
  const loan = g.loans[0]; loan.amount = 100; loan.rate = 0; loan.months = 3;
  assert.deepEqual(remainingInstallments(loan).map(p => p.amount), [33.33, 33.33, 33.34]);
  const schedule = remainingInstallments(loan);
  for (const p of schedule) {
    const before = loan.repaid;
    updateGroup(g, 'tester', 'repay', { loanId: loan.id });
    assert.equal(round(loan.repaid - before), p.amount);
    assert.equal(remainingInstallments(loan).length, 3 - p.number);
  }
  assert.equal(loan.status, 'repaid');
  assert.equal(loan.repaid, loanTotal(loan));
});

test('unapproved and other members’ loans cannot be repaid', () => {
  const g = makeDemo('tester', 'Test Member')[0];
  assert.deepEqual(remainingInstallments(g.loans[0]), []);
  assert.throws(() => updateGroup(g, 'tester', 'repay', {loanId:g.loans[0].id}), /No repayable/);
});

test('savings forecasts do not double count loan repayments and available funds include only scheduled repayments', () => {
  const g = makeDemo('tester', 'Test Member')[1];
  g.target = groupSavings(g) + 1000 * g.members.length * 2;
  const snapshot = JSON.stringify(g);
  const result = projectGoal(g, 1000, '2026-12');
  assert.equal(result.months, 2);
  assert.equal(result.date?.toISOString().slice(0, 10), '2027-02-10');
  assert.equal(result.projectedFund, round(pool(g) + 12000 + 1030));
  assert.equal(JSON.stringify(g), snapshot);
});

test('forecast handles zero contributions, completed goals and horizons beyond 100 years', () => {
  const g = makeDemo('tester', 'Test Member')[0];
  assert.equal(projectGoal(g, 0, '2026-11').months, null);
  assert.equal(projectGoal(g, 0.01, '2026-11').date, null);
  g.target = groupSavings(g);
  assert.equal(projectGoal(g, 0, '2026-11').months, 0);
  assert.equal(projectGoal(g, 0, '2026-11').projectedFund, pool(g));
});

test('contribution receipts can use persisted activity and a contribution leaves the pending list exactly once', () => {
  const g = makeDemo('tester', 'Test Member')[0];
  assert.notEqual(g.members[0].paidMonth, monthKey());
  const oldActivity = new Set(g.activity.map(a => a.id));
  updateGroup(g, 'tester', 'contribute', {});
  const receipt = g.activity.find(a => !oldActivity.has(a.id));
  assert.equal(receipt?.amount, g.monthly);
  assert.equal(receipt?.type, 'contribution');
  assert.equal(g.members[0].paidMonth, monthKey());
  assert.throws(() => updateGroup(g, 'tester', 'contribute', {}), /already paid/);
});

test('a confirmed vote is audited, final, and preserves the approval threshold', () => {
  const g = makeDemo('tester', 'Test Member')[0];
  const loan = g.loans[0];
  updateGroup(g, 'tester', 'vote', {loanId:loan.id,approve:true});
  assert.equal(loan.status, 'voting');
  assert.equal(loan.voteAudit?.[0].memberId, 'tester');
  assert.throws(() => updateGroup(g, 'tester', 'vote', {loanId:loan.id,approve:false}), /already been recorded/);
});
