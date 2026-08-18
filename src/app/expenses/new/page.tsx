"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Group, Profile } from "@/lib/types";

interface GroupWithMembers extends Group {
  members: Profile[];
}

export default function NewExpensePage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);

  // Form State
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("general");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUserId(user.id);
    setPaidBy(user.id);

    // Fetch user's groups
    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id, groups(id, name, created_at, created_by)")
      .eq("user_id", user.id);

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const groupList = (memberships ?? [])
      .map((m) => (Array.isArray(m.groups) ? m.groups[0] : m.groups))
      .filter(Boolean) as Group[];

    if (groupList.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // Fetch members for these groups
    const groupIds = groupList.map((g) => g.id);
    const { data: memberRows, error: memberError } = await supabase
      .from("group_members")
      .select("group_id, profiles(id, full_name, email, avatar_url)")
      .in("group_id", groupIds);

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const groupsWithMembers: GroupWithMembers[] = groupList.map((group) => {
      const relevantMembers = (
        memberRows as { group_id: string; profiles: Profile | Profile[] | null }[]
      )
        .filter((r) => r.group_id === group.id)
        .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
        .filter(Boolean) as Profile[];

      return {
        ...group,
        members: relevantMembers,
      };
    });

    setGroups(groupsWithMembers);
    if (groupsWithMembers.length > 0) {
      setSelectedGroupId(groupsWithMembers[0].id);
      setSplitWith(groupsWithMembers[0].members.map((m) => m.id));
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Update selected group members when group dropdown changes
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = groups.find((g) => g.id === groupId);
    if (grp) {
      setSplitWith(grp.members.map((m) => m.id));
    }
  };

  const handleToggleMember = (memberId: string) => {
    setSplitWith((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !description || !amount || splitWith.length === 0) {
      setError("Please fill all required fields and select at least one person to split with.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSaving(true);
    setError(null);

    // 1. Insert the main expense
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        group_id: selectedGroupId,
        description,
        amount: numAmount,
        paid_by: paidBy,
        category,
        is_settlement: false,
      })
      .select("id")
      .single();

    if (expenseError || !expenseData) {
      setError(expenseError?.message || "Failed to create expense.");
      setSaving(false);
      return;
    }

    // 2. Insert the equal splits
    const splitAmount = Number((numAmount / splitWith.length).toFixed(2));
    const splitsToInsert = splitWith.map((userId) => ({
      expense_id: expenseData.id,
      user_id: userId,
      amount_owed: splitAmount,
    }));

    const { error: splitError } = await supabase.from("expense_splits").insert(splitsToInsert);

    if (splitError) {
      setError(splitError.message);
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const activeGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Expense</h1>
          <p className="text-xs text-slate-500">Split a new bill with your group</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-slate-700">No groups found</p>
              <p className="text-xs text-slate-500 mt-1">
                You must belong to at least one group before creating expenses.
              </p>
              <Link
                href="/groups"
                className="mt-4 inline-block rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white"
              >
                Create a Group
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Group</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Dinner, Groceries, Movie"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Paid By</label>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  required
                >
                  {activeGroup?.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.id === currentUserId
                        ? "You"
                        : member.full_name || member.email || "Member"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Split With ({splitWith.length} people)
                </label>
                <div className="space-y-1.5 rounded-lg border border-slate-200 p-2 max-h-48 overflow-y-auto">
                  {activeGroup?.members.map((member) => {
                    const isChecked = splitWith.includes(member.id);
                    return (
                      <button
                        type="button"
                        key={member.id}
                        onClick={() => handleToggleMember(member.id)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium transition ${
                          isChecked
                            ? "bg-teal-50 text-teal-900 border border-teal-200"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span>
                          {member.id === currentUserId
                            ? "You"
                            : member.full_name || member.email || "Member"}
                        </span>
                        {isChecked && <Check className="h-4 w-4 text-teal-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving Expense..." : "Save Expense"}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}