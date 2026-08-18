import { CalendarDays, ReceiptText } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenseWithSplits, Profile } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type ExpenseListProps = {
  expenses: ExpenseWithSplits[];
  userMap: Record<string, Profile>;
  title?: string;
};

export function ExpenseList({ expenses, userMap, title = "Recent Activity" }: ExpenseListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {expenses.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No expenses yet. Add your first one to start tracking balances.
          </p>
        ) : (
          expenses.map((expense) => {
            const payer = userMap[expense.paid_by];
            return (
              <div
                key={expense.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={payer?.full_name ?? "Unknown"} avatarUrl={payer?.avatar_url} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{expense.description}</p>
                      <p className="text-xs text-slate-500">
                        Paid by {payer?.full_name ?? "Unknown"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {formatCurrency(Number(expense.amount))}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{expense.category}</Badge>
                  {expense.is_settlement && <Badge variant="outline">Settlement</Badge>}
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(expense.created_at).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <ReceiptText className="h-3 w-3" />
                    {expense.splits.length} split(s)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
