"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Users, ArrowLeft, ArrowUpRight, ArrowDownLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ExpenseWithSplits, ExpenseSplit } from "@/lib/types";

interface FriendBalance {
  profile: Profile;
  balance: number; // positive: they owe you, negative: you owe them
  sharedGroupsCount: number;
}

type MemberProfileRow = {
  profiles: Profile | Profile[] | null;
};

export default function FriendsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendBalances, setFriendBalances] = useState<FriendBalance[]>([]);

  const loadFriendsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    // 1. Get user's groups
    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    if (groupIds.length === 0) {
      setFriendBalances([]);
      setLoading(false);
      return;
    }

    // 2. Fetch all members across these groups
    const { data: profileRows, error: profileError } = await supabase
      .from("group_members")
      .select("group_id, profiles(id, full_name, email, avatar_url)")
      .in("group_id", groupIds);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const friendGroupCountMap: Record<string, { profile: Profile; count: number }> = {};

    (profileRows as { group_id: string; profiles: Profile | Profile[] | null }[]).forEach((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!p || p.id === user.id) return;

      if (!friendGroupCountMap[p.id]) {
        friendGroupCountMap[p.id] = { profile: p, count: 0 };
      }
      friendGroupCountMap[p.id].count += 1;
    });

    // 3. Fetch expenses and calculate net balance with each friend
    const { data: expenseRows, error: expenseError } = await supabase
      .from("expenses")
      .select("id, group_id, paid_by, amount, is_settlement")
      .in("group_id", groupIds);

    if (expenseError) {
      setError(expenseError.message);
      setLoading(false);
      return;
    }

    const expenseIds = expenseRows.map((e) => e.id);
    let splits: ExpenseSplit[] = [];

    if (expenseIds.length > 0) {
      const { data: splitData } = await supabase
        .from("expense_splits")
        .select("id, expense_id, user_id, amount_owed")
        .in("expense_id", expenseIds);

      splits = splitData ?? [];
    }

    const balancesByFriend: Record<string, number> = {};
    Object.keys(friendGroupCountMap).forEach((id) => {
      balancesByFriend[id] = 0;
    });

    expenseRows.forEach((expense) => {
      const relevantSplits = splits.filter((s) => s.expense_id === expense.id);

      // If current user paid, all friends who owe money increase positive balance
      if (expense.paid_by === user.id) {
        relevantSplits.forEach((s) => {
          if (s.user_id !== user.id && balancesByFriend[s.user_id] !== undefined) {
            balancesByFriend[s.user_id] += Number(s.amount_owed);
          }
        });
      } else {
        // Someone else paid; check if current user owes them
        const mySplit = relevantSplits.find((s) => s.user_id === user.id);
        if (mySplit && balancesByFriend[expense.paid_by] !== undefined) {
          balancesByFriend[expense.paid_by] -= Number(mySplit.amount_owed);
        }
      }
    });

    const result: FriendBalance[] = Object.values(friendGroupCountMap).map(({ profile, count }) => ({
      profile,
      balance: balancesByFriend[profile.id] ?? 0,
      sharedGroupsCount: count,
    }));

    setFriendBalances(result);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadFriendsData();
  }, [loadFriendsData]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Friends</h1>
            <p className="text-xs text-slate-500">People you share expenses and groups with</p>
          </div>
        </div>

        <Link
          href="/groups"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          <Users className="h-3.5 w-3.5" />
          View Groups
        </Link>
      </div>

      {/* Friends List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Friends ({friendBalances.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Loading friends...</p>
          ) : error ? (
            <p className="text-sm text-rose-600 py-4 text-center">{error}</p>
          ) : friendBalances.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No friends found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add friends by creating a group and inviting them using your group invite code!
              </p>
              <Link
                href="/groups"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
              >
                Go to Groups &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {friendBalances.map(({ profile, balance, sharedGroupsCount }) => (
                <div key={profile.id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold text-sm uppercase">
                      {profile.full_name?.charAt(0) || profile.email?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {profile.full_name || profile.email || "Unnamed User"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sharedGroupsCount} shared group{sharedGroupsCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {balance > 0 ? (
                      <div className="flex items-center gap-1 text-emerald-600 font-semibold text-sm justify-end">
                        <ArrowDownLeft className="h-4 w-4" />
                        <span>owes you ${balance.toFixed(2)}</span>
                      </div>
                    ) : balance < 0 ? (
                      <div className="flex items-center gap-1 text-rose-600 font-semibold text-sm justify-end">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>you owe ${Math.abs(balance).toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Settled up</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}