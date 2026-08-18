import type { ExpenseWithSplits, Profile } from "@/lib/types";

export type NetBalances = Record<string, number>;

export type SettlementTransaction = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type GroupBalanceResult = {
  netBalances: NetBalances;
  settlements: SettlementTransaction[];
};

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateGroupBalances(
  expenses: ExpenseWithSplits[],
  members: Pick<Profile, "id" | "full_name">[]
): GroupBalanceResult {
  const netBalances: NetBalances = {};

  for (const member of members) {
    netBalances[member.id] = 0;
  }

  for (const expense of expenses) {
    netBalances[expense.paid_by] = roundToCents(
      (netBalances[expense.paid_by] ?? 0) + Number(expense.amount)
    );

    for (const split of expense.splits) {
      netBalances[split.user_id] = roundToCents(
        (netBalances[split.user_id] ?? 0) - Number(split.amount_owed)
      );
    }
  }

  const creditors = Object.entries(netBalances)
    .filter(([, amount]) => amount > 0.009)
    .map(([userId, amount]) => ({ userId, amount: roundToCents(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(netBalances)
    .filter(([, amount]) => amount < -0.009)
    .map(([userId, amount]) => ({ userId, amount: roundToCents(Math.abs(amount)) }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = roundToCents(Math.min(debtor.amount, creditor.amount));

    if (settledAmount > 0) {
      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: settledAmount,
      });
    }

    debtor.amount = roundToCents(debtor.amount - settledAmount);
    creditor.amount = roundToCents(creditor.amount - settledAmount);

    if (debtor.amount <= 0.009) i += 1;
    if (creditor.amount <= 0.009) j += 1;
  }

  for (const memberId of Object.keys(netBalances)) {
    netBalances[memberId] = roundToCents(netBalances[memberId]);
  }

  return { netBalances, settlements };
}
