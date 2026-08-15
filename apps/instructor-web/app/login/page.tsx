"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already-signed-in case: don't show the form, hand off to / to sort out
  // whether they're an instructor.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled && session) {
        router.replace("/");
        return;
      }
      if (!cancelled) setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace("/");
  }

  if (checkingSession) {
    return (
      <main className="centered-shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="centered-shell">
      <div className="card">
        <div className="card-header">
          <div className="mascot-circle">
            <Image src="/pip-neutral.png" alt="" width={240} height={288} priority />
          </div>
          <div>
            <div className="wordmark" style={{ justifyContent: "center" }}>
              <span className="wordmark-brand">ClearPass</span>
              <span className="wordmark-context">Instructors</span>
            </div>
            <h1 style={{ marginTop: "0.6rem", fontWeight: 600, fontSize: "1rem", color: "var(--text-dark)" }}>
              Sign in to manage learner seats
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0, textAlign: "center" }}>
          Use the same email and password as your ClearPass mobile app account.
        </p>
      </div>
    </main>
  );
}
