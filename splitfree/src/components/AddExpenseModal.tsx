"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_OPTIONS, type Category, type Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

type SplitMethod = "equal" | "exact" | "percentage";

type AddExpenseModalProps = {
  groupId: string;
  members: Profile[];
  currentUserId: string;
  onCreated: () => void;
};

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function AddExpenseModal({
  groupId,
  members,
  currentUserId,
  onCreated,
}: AddExpenseModalProps) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<Category>("General");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members.map((m) => m.id));
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Number(amount || 0);

  const splitPreview = useMemo(() => {
    if (!total || selectedMembers.length === 0) return {} as Record<string, number>;

    if (splitMethod === "equal") {
      const cents = Math.round(total * 100);
      const base = Math.floor(cents / selectedMembers.length);
      const remainder = cents - base * selectedMembers.length;
      const result: Record<string, number> = {};
      selectedMembers.forEach((id, index) => {
        result[id] = (base + (index < remainder ? 1 : 0)) / 100;
      });
      return result;
    }

    if (splitMethod === "exact") {
      const result: Record<string, number> = {};
      selectedMembers.forEach((id) => {
        result[id] = Number(exactAmounts[id] || 0);
      });
      return result;
    }

    const result: Record<string, number> = {};
    let running = 0;
    selectedMembers.forEach((id, idx) => {
      if (idx === selectedMembers.length - 1) {
        result[id] = roundToCents(total - running);
      } else {
        const pct = Number(percentages[id] || 0);
        const value = roundToCents((total * pct) / 100);
        result[id] = value;
        running += value;
      }
    });

    return result;
  }, [total, splitMethod, selectedMembers, exactAmounts, percentages]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!description.trim()) return setError("Description is required.");
    if (total <= 0) return setError("Amount must be greater than zero.");
    if (!paidBy) return setError("Choose who paid.");
    if (selectedMembers.length === 0) return setError("Select at least one member.");

    if (splitMethod === "exact") {
      const sum = selectedMembers.reduce((acc, id) => acc + Number(exactAmounts[id] || 0), 0);
      if (Math.abs(sum - total) > 0.01) {
        return setError("Exact split amounts must sum exactly to the total.");
      }
    }

    if (splitMethod === "percentage") {
      const pct = selectedMembers.reduce((acc, id) => acc + Number(percentages[id] || 0), 0);
      if (Math.abs(pct - 100) > 0.01) {
        return setError("Percentage values must sum to 100.");
      }
    }

    const splits = selectedMembers.map((userId) => ({
      user_id: userId,
      amount_owed: roundToCents(splitPreview[userId] || 0),
    }));

    setLoading(true);

    try {
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: groupId,
          description: description.trim(),
          amount: roundToCents(total),
          paid_by: paidBy,
          category,
          is_settlement: false,
          created_at: new Date(`${date}T12:00:00`).toISOString(),
        })
        .select("id")
        .single();

      if (expenseError) throw expenseError;

      const { error: splitError } = await supabase.from("expense_splits").insert(
        splits.map((split) => ({
          expense_id: expense.id,
          user_id: split.user_id,
          amount_owed: split.amount_owed,
        }))
      );

      if (splitError) throw splitError;

      setDescription("");
      setAmount("");
      setCategory("General");
      setPaidBy(currentUserId);
      setSplitMethod("equal");
      setSelectedMembers(members.map((m) => m.id));
      setExactAmounts({});
      setPercentages({});
      setOpen(false);
      onCreated();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to create expense. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Expense
      </Button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-3 md:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Add Expense</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dinner at Katsu House"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Total amount"
                  required
                />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                >
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <select
                  className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Split Method</p>
                <div className="flex gap-2">
                  {(["equal", "exact", "percentage"] as SplitMethod[]).map((method) => (
                    <Button
                      key={method}
                      type="button"
                      size="sm"
                      variant={splitMethod === method ? "default" : "secondary"}
                      onClick={() => setSplitMethod(method)}
                    >
                      {method}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-700">Members</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {members.map((member) => {
                    const checked = selectedMembers.includes(member.id);
                    return (
                      <label key={member.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{member.full_name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers((prev) => [...prev, member.id]);
                              } else {
                                setSelectedMembers((prev) => prev.filter((id) => id !== member.id));
                              }
                            }}
                          />
                        </div>

                        {checked && splitMethod === "exact" && (
                          <Input
                            className="mt-2 h-8"
                            type="number"
                            min="0"
                            step="0.01"
                            value={exactAmounts[member.id] ?? ""}
                            onChange={(e) =>
                              setExactAmounts((prev) => ({ ...prev, [member.id]: e.target.value }))
                            }
                            placeholder="Amount"
                          />
                        )}

                        {checked && splitMethod === "percentage" && (
                          <Input
                            className="mt-2 h-8"
                            type="number"
                            min="0"
                            step="0.01"
                            value={percentages[member.id] ?? ""}
                            onChange={(e) =>
                              setPercentages((prev) => ({ ...prev, [member.id]: e.target.value }))
                            }
                            placeholder="Percent"
                          />
                        )}

                        {checked && splitMethod === "equal" && total > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Owes: ${splitPreview[member.id]?.toFixed(2) ?? "0.00"}
                          </p>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <Button disabled={loading} className="w-full" type="submit">
                {loading ? "Saving..." : "Save Expense"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
