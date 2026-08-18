"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BalanceCard } from "@/components/BalanceCard";
import { ExpenseList } from "@/components/ExpenseList";
import { SignOutButton } from "@/components/SignOutButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateGroupBalances } from "@/lib/settlement";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseSplit, ExpenseWithSplits, Profile } from "@/lib/types";

type MemberProfileRow = {
  profiles: Profile | Profile[] | null;
};

export default function Home() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUserId(user.id);

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((membership) => membership.group_id);

    if (groupIds.length === 0) {
      setProfiles([{ id: user.id, full_name: "You", avatar_url: null }]);
      setExpenses([]);
      setLoading(false);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("group_members")
      .select("profiles(id, full_name, email, avatar_url)")
      .in("group_id", groupIds);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const mappedProfiles = (profileRows as MemberProfileRow[])
      .map((row) => (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles))
      .filter(Boolean) as Profile[];

    const uniqueProfiles = Object.values(
      mappedProfiles.reduce<Record<string, Profile>>((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {})
    );

    const { data: expenseRows, error: expenseError } = await supabase
      .from("expenses")
      .select("id,group_id,description,amount,paid_by,category,is_settlement,created_at")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false })
      .limit(30);

    if (expenseError) {
      setError(expenseError.message);
      setLoading(false);
      return;
    }

    const expenseIds = expenseRows.map((expense) => expense.id);

    let splitRows: ExpenseSplit[] = [];
    if (expenseIds.length > 0) {
      const { data: splits, error: splitError } = await supabase
        .from("expense_splits")
        .select("id,expense_id,user_id,amount_owed")
        .in("expense_id", expenseIds);

      if (splitError) {
        setError(splitError.message);
        setLoading(false);
        return;
      }

      splitRows = (splits ?? []).map((split) => ({
        ...split,
        amount_owed: Number(split.amount_owed),
      }));
    }

    const expenseList: ExpenseWithSplits[] = expenseRows.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      splits: splitRows.filter((split) => split.expense_id === expense.id),
    }));

    setProfiles(uniqueProfiles);
    setExpenses(expenseList);
    setLoading(false);
  }, [router, supabase]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const userMap = useMemo(() => {
    return profiles.reduce<Record<string, Profile>>((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {});
  }, [profiles]);

  const balances = useMemo(() => {
    return calculateGroupBalances(expenses, profiles);
  }, [expenses, profiles]);

  const currentNet = balances.netBalances[currentUserId] ?? 0;
  const totalOwed = currentNet > 0 ? currentNet : 0;
  const totalYouOwe = currentNet < 0 ? Math.abs(currentNet) : 0;

  const spendWithoutSettlements = expenses
    .filter((expense) => !expense.is_settlement && expense.paid_by === currentUserId)
    .reduce((acc, expense) => acc + Number(expense.amount), 0);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">SplitFree</h1>
          <p className="text-sm text-slate-600">Personal expense tracking between friends.</p>
        </div>
        <SignOutButton />
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Link
          href="/expenses/new"
          className="flex flex-col items-center justify-center rounded-xl bg-teal-700 p-3 text-center text-white shadow-sm transition hover:bg-teal-800"
        >
          <span className="text-xl font-bold leading-none">+</span>
          <span className="mt-1 text-xs font-semibold sm:text-sm">Add Expense</span>
        </Link>
        <Link
          href="/groups"
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <span className="text-lg leading-none">👥</span>
          <span className="mt-1 text-xs font-semibold sm:text-sm">Groups</span>
        </Link>
        <Link
          href="/friends"
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <span className="text-lg leading-none">👤</span>
          <span className="mt-1 text-xs font-semibold sm:text-sm">Friends</span>
        </Link>
      </div>

      {/* Balance Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BalanceCard label="Total You are Owed" amount={totalOwed} tone="owed" />
        <BalanceCard label="Total You Owe" amount={totalYouOwe} tone="owe" />
        <BalanceCard label="Total Net Balance" amount={currentNet} tone="net" />
      </section>

      {/* Spending Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Loading dashboard...</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : (
            <p className="text-sm text-slate-700">
              Non-settlement spend (you paid): ${spendWithoutSettlements.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity List */}
      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-slate-600">Loading activity...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-4 text-sm text-rose-600">{error}</CardContent>
        </Card>
      ) : (
        <ExpenseList expenses={expenses} userMap={userMap} />
      )}
    </main>
  );
}