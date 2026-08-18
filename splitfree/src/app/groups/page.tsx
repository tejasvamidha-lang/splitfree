"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Plus } from "lucide-react";

import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Group } from "@/lib/types";

export default function GroupsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [inviteCode] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("invite");
  });

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const ids = memberships.map((item) => item.group_id);

    if (ids.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data: groupRows, error: groupError } = await supabase
      .from("groups")
      .select("id,name,created_by,created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (groupError) {
      setError(groupError.message);
      setLoading(false);
      return;
    }

    setGroups((groupRows ?? []) as Group[]);
    setLoading(false);
  }, [router, supabase]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!userId) return;
    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({
        name: groupName.trim(),
        created_by: userId,
      })
      .select("id")
      .single();

    if (groupError) {
      setError(groupError.message);
      return;
    }

    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: userId,
    });

    if (memberError) {
      setError(memberError.message);
      return;
    }

    setGroupName("");
    setMessage("Group created.");
    await loadGroups();
  }

  async function joinWithInvite(code: string) {
    setError(null);
    setMessage(null);

    if (!userId) return;

    const { error: joinError } = await supabase.from("group_members").upsert(
      {
        group_id: code,
        user_id: userId,
      },
      {
        onConflict: "group_id,user_id",
        ignoreDuplicates: true,
      }
    );

    if (joinError) {
      setError(joinError.message);
      return;
    }

    setMessage("You joined the group.");
    await loadGroups();
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-24 pt-6 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Your Groups</h1>
          <p className="text-sm text-slate-600">Create a group or join using an invite code.</p>
        </div>
        <SignOutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Group</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createGroup}>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Trip to Goa / Flat Utilities / Roommate"
            />
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {inviteCode && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-emerald-800">Invite code detected: {inviteCode}</p>
            <Button size="sm" onClick={() => joinWithInvite(inviteCode)}>
              <Link2 className="mr-2 h-4 w-4" />
              Join Group
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <section className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-600">Loading groups...</p>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-slate-600">
              No groups yet. Create one to start tracking expenses.
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{group.name}</p>
                  <p className="text-xs text-slate-500">
                    Created {new Date(group.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const inviteLink = `${window.location.origin}/groups?invite=${group.id}`;
                      await navigator.clipboard.writeText(inviteLink);
                      setMessage("Invite link copied.");
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Invite
                  </Button>
                  <Button asChild>
                    <Link href={`/group/${group.id}`}>Open</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
