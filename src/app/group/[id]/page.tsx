"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronLeft, CheckCircle2, Loader2, HandCoins } from "lucide-react";

import { AddExpenseModal } from "@/components/AddExpenseModal";
import { BalanceCard } from "@/components/BalanceCard";
import { ExpenseList } from "@/components/ExpenseList";
import { SettleUpModal } from "@/components/SettleUpModal";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateGroupBalances } from "@/lib/settlement";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseSplit, ExpenseWithSplits, Group, Profile } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type GroupMemberRow = {
  user_id: string;
  profiles: Profile | Profile[] | null;
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);

  // Manual Settle State
  const [showManualSettle, setShowManualSettle] = useState(false);
  const [settleRecipient, setSettleRecipient] = useState<string>("");
  const [settleAmount, setSettleAmount] = useState<string>("");
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUserId(user.id);

    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .select("id,name,created_by,created_at")
      .eq("id", id)
      .single();

    if (groupError) {
      setError(groupError.message);
      setLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("group_members")
      .select("user_id, profiles(id, full_name, email, avatar_url)")
      .eq("group_id", id);

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const mappedMembers = (memberRows as GroupMemberRow[])
      .map((row) => {
        if (Array.isArray(row.profiles)) return row.profiles[0];
        return row.profiles;
      })
      .filter(Boolean) as Profile[];

    const { data: expenseRows, error: expenseError } = await supabase
      .from("expenses")
      .select("id,group_id,description,amount,paid_by,category,is_settlement,created_at")
      .eq("group_id", id)
      .order("created_at", { ascending: false });

    if (expenseError) {
      setError(expenseError.message);
      setLoading(false);
      return;
    }

    const expenseIds = expenseRows.map((expense) => expense.id);
    let splitRows: ExpenseSplit[] = [];

    if (expenseIds.length > 0) {
      const { data: splitData, error: splitError } = await supabase
        .from("expense_splits")
        .select("id,expense_id,user_id,amount_owed")
        .in("expense_id", expenseIds);

      if (splitError) {
        setError(splitError.message);
        setLoading(false);
        return;
      }

      splitRows = (splitData ?? []).map((split) => ({
        ...split,
        amount_owed: Number(split.amount_owed),
      }));
    }

    const expensesWithSplits: ExpenseWithSplits[] = expenseRows.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      splits: splitRows.filter((split) => split.expense_id === expense.id),
    }));

    setGroup(groupData as Group);
    setMembers(mappedMembers);
    setExpenses(expensesWithSplits);

    // Set default recipient to someone else in the group
    const otherMember = mappedMembers.find((m) => m.id !== user.id);
    if (otherMember) {
      setSettleRecipient(otherMember.id);
    }

    setLoading(false);
  }, [id, router, supabase]);

  useEffect(() => {
    if (id) {
      void loadData();
    }
  }, [id, loadData]);

  const userMap = useMemo(() => {
    return members.reduce<Record<string, Profile>>((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, {});
  }, [members]);

  const balanceResult = useMemo(() => {
    return calculateGroupBalances(expenses, members);
  }, [expenses, members]);

  const currentNet = balanceResult.netBalances[currentUserId] ?? 0;
  const youAreOwed = currentNet > 0 ? currentNet : 0;
  const youOwe = currentNet < 0 ? Math.abs(currentNet) : 0;

  // Direct manual settlement function
  const handleDirectSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleRecipient || !settleAmount || parseFloat(settleAmount) <= 0) {
      setSettleError("Please enter a valid amount and recipient.");
      return;
    }

    setSettling(true);
    setSettleError(null);

    const amountNum = parseFloat(settleAmount);

    // 1. Create settlement expense
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        group_id: id,
        description: `Settlement to ${userMap[settleRecipient]?.full_name || "friend"}`,
        amount: amountNum,
        paid_by: currentUserId,
        category: "settlement",
        is_settlement: true,
      })
      .select("id")
      .single();

    if (expenseError || !expenseData) {
      setSettleError(expenseError?.message || "Failed to record settlement.");
      setSettling(false);
      return;
    }

    // 2. Insert split for recipient
    const { error: splitError } = await supabase.from("expense_splits").insert({
      expense_id: expenseData.id,
      user_id: settleRecipient,
      amount_owed: amountNum,
    });

    if (splitError) {
      setSettleError(splitError.message);
      setSettling(false);
      return;
    }

    setSettling(false);
    setShowManualSettle(false);
    setSettleAmount("");
    await loadData();
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-slate-600">Loading group...</p>
      </main>
    );
  }

  if (error || !group) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-rose-600">{error ?? "Group not found."}</p>
      </main>
    );
  }

  const otherMembers = members.filter((m) => m.id !== currentUserId);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-24 pt-6 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/groups">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{group.name}</h1>
          <p className="text-sm text-slate-600">{members.length} member(s)</p>
        </div>
        <SignOutButton />
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BalanceCard label="Total You are Owed" amount={youAreOwed} tone="owed" />
        <BalanceCard label="Total You Owe" amount={youOwe} tone="owe" />
        <BalanceCard label="Total Net Balance" amount={currentNet} tone="net" />
      </section>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <AddExpenseModal
          groupId={group.id}
          members={members}
          currentUserId={currentUserId}
          onCreated={loadData}
        />
        <SettleUpModal
          groupId={group.id}
          members={members}
          suggestions={balanceResult.settlements}
          onSettled={loadData}
        />
        <Button
          variant="outline"
          onClick={() => setShowManualSettle(!showManualSettle)}
          className="border-teal-700 text-teal-800 hover:bg-teal-50"
        >
          <HandCoins className="mr-2 h-4 w-4" />
          Direct Settle
        </Button>
      </div>

      {/* Manual Settle Up Drawer / Card */}
      {showManualSettle && (
        <Card className="border-teal-300 bg-teal-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-teal-900">Record a Settlement</CardTitle>
          </CardHeader>
          <CardContent>
            {otherMembers.length === 0 ? (
              <p className="text-xs text-slate-600">No other members in this group to settle with.</p>
            ) : (
              <form onSubmit={handleDirectSettle} className="space-y-3">
                {settleError && <p className="text-xs font-semibold text-rose-600">{settleError}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Paying To
                    </label>
                    <select
                      value={settleRecipient}
                      onChange={(e) => setSettleRecipient(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {otherMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name || m.email || "Member"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={() => setShowManualSettle(false)}
  >
    Cancel
  </Button>
  <Button
    type="submit"
    size="sm"
    disabled={settling}
    className="bg-teal-700 text-white hover:bg-teal-800"
  >
    {settling && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
    Confirm Settlement
  </Button>
</div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" />
            Debt Simplification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {balanceResult.settlements.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Everything is settled up in this group.
            </div>
          ) : (
            balanceResult.settlements.map((settlement, index) => (
              <p key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`} className="text-sm text-slate-700">
                {userMap[settlement.fromUserId]?.full_name ?? "Unknown"} owes {" "}
                {userMap[settlement.toUserId]?.full_name ?? "Unknown"} {" "}
                {formatCurrency(settlement.amount)}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <ExpenseList expenses={expenses} userMap={userMap} title="Group Activity" />
    </main>
  );
}