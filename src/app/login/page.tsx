"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/");
      }
    }

    bootstrap();
  }, [router, supabase]);

  async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function signUp() {
    setError(null);
    setMessage(null);

    if (!fullName.trim()) {
      setError("Full name is required for first-time sign up.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setMessage("Account created. Check your inbox if email confirmation is enabled.");
  }

  async function sendMagicLink() {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);

    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    setLoading(false);

    if (magicError) {
      setError(magicError.message);
      return;
    }

    setMessage("Magic link sent. Open your email to continue.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">SplitFree</CardTitle>
          <CardDescription>
            Log in with password or magic link to track shared expenses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={signInWithPassword}>
            <Input
              placeholder="Full name (required for sign up)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {message && <p className="text-sm text-emerald-600">{message}</p>}

            <Button disabled={loading} className="w-full" type="submit">
              {loading ? "Please wait..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button disabled={loading} variant="secondary" onClick={signUp}>
              Create Account
            </Button>
            <Button disabled={loading} variant="outline" onClick={sendMagicLink}>
              Send Magic Link
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
