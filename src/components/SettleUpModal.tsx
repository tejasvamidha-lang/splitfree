"use client";

import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

type SettlementSuggestion = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

type SettleUpModalProps = {
  groupId: string;
  members: Profile[];
  suggestions: SettlementSuggestion[];
  onSettled: () => void;
};

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function SettleUpModal({ groupId, members, suggestions, onSettled }: SettleUpModalProps) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [debtorId, setDebtorId] = useState(members[0]?.id ?? "");
  const [creditorId, setCreditorId] = useState(members[1]?.id ?? members[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    return members.reduce<Record<string, Profile>>((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, {});
  }, [members]);

  async function createSettlement(fromUserId: string, toUserId: string, settledAmount: number) {
    if (!fromUserId || !toUserId || fromUserId === toUserId) {
      throw new Error("Choose two different members.");
    }
    if (settledAmount <= 0) {
      throw new Error("Settlement amount must be greater than zero.");
    }

    const fromName = memberMap[fromUserId]?.full_name ?? "Member";
    const toName = memberMap[toUserId]?.full_name ?? "Member";

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        group_id: groupId,
        description: `Settlement: ${fromName} paid ${toName}`,
        amount: roundToCents(settledAmount),
        paid_by: fromUserId,
        category: "General",
        is_settlement: true,
      })
      .select("id")
      .single();

    if (expenseError) throw expenseError;

    const { error: splitError } = await supabase.from("expense_splits").insert([
      {
        expense_id: expense.id,
        user_id: fromUserId,
        amount_owed: 0,
      },
      {
        expense_id: expense.id,
        user_id: toUserId,
        amount_owed: roundToCents(settledAmount),
      },
    ]);

    if (splitError) throw splitError;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createSettlement(debtorId, creditorId, Number(amount));
      setAmount("");
      setOpen(false);
      onSettled();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to settle up.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <HandCoins className="mr-2 h-4 w-4" />
        Settle Up
      </Button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-3 md:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Settle Debt</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">Quick Settlements</p>
              {suggestions.length === 0 ? (
                <p className="text-xs text-slate-500">All clear. No pending debt suggestions.</p>
              ) : (
                suggestions.map((item, index) => (
                  <div key={`${item.fromUserId}-${item.toUserId}-${index}`} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-700">
                      {memberMap[item.fromUserId]?.full_name ?? "Unknown"} owes {" "}
                      {memberMap[item.toUserId]?.full_name ?? "Unknown"} ${item.amount.toFixed(2)}
                    </p>
                    <Button
                      size="sm"
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        setError(null);
                        try {
                          await createSettlement(item.fromUserId, item.toUserId, item.amount);
                          onSettled();
                        } catch (quickSettleError) {
                          const message =
                            quickSettleError instanceof Error
                              ? quickSettleError.message
                              : "Failed quick settlement.";
                          setError(message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      One Click
                    </Button>
                  </div>
                ))
              )}
            </div>

            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                  value={debtorId}
                  onChange={(e) => setDebtorId(e.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      Debtor: {member.full_name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                  value={creditorId}
                  onChange={(e) => setCreditorId(e.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      Creditor: {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Settlement amount"
                required
              />

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <Button disabled={loading} className="w-full" type="submit">
                {loading ? "Settling..." : "Create Settlement"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
