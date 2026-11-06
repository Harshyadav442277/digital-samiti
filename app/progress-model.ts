import { Group, Loan, groupSavings, loanTotal, pool, round } from './model';

// Match the ledger's rounding, including its final installment adjustment.
export function remainingInstallments(loan: Loan) {
  if (loan.status !== 'approved') return [];
  let remaining = round(Math.max(0, loanTotal(loan) - loan.repaid));
  const result: { number: number; amount: number }[] = [];
  for (let i = loan.paidInstallments; i < loan.months && remaining > 0; i++) {
    const amount = i >= loan.months - 1 ? remaining : Math.min(remaining, round(loanTotal(loan) / loan.months));
    result.push({ number: i + 1, amount });
    remaining = round(remaining - amount);
  }
  return result;
}

export function projectGoal(group: Group, monthlyPerMember: number, period: string) {
  const remaining = Math.max(0, round(group.target - groupSavings(group)));
  const monthly = round(monthlyPerMember * group.members.length);
  const months = remaining === 0 ? 0 : monthly > 0 && Number.isFinite(monthly) ? Math.ceil(remaining / monthly) : null;
  const [year, month] = period.split('-').map(Number);
  const date = months !== null && months <= 1200 ? new Date(Date.UTC(year, month - 1 + months, 10)) : null;
  const repayments = months === null ? 0 : group.loans.reduce((sum, loan) => sum + remainingInstallments(loan).slice(0, months).reduce((s, p) => s + p.amount, 0), 0);
  return { months, date, monthly, projectedFund: months !== null ? round(pool(group) + monthly * months + repayments) : null };
}
