"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { AUTH_REDIRECT_URL, supabase } from "@/lib/supabase";
import { getOtpErrorMessage } from "@/lib/authErrors";
import CheckYourEmail from "@/components/CheckYourEmail";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="centered-shell">
          <p className="muted">Loading…</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const targetEmail = email.trim();

    try {
      const res = await fetch(`${API_URL}/api/instructor/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, ref }),
      });

      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts — please wait a moment and try again."
            : "Something went wrong. Please try again."
        );
        return;
      }

      // This endpoint always returns { ok: true } uniformly — new signup,
      // returning instructor, or existing learner address all look the
      // same on purpose (see proxy.js), so there is nothing to branch on
      // here. This second call is the same signInWithOtp login/page.tsx
      // uses to actually send the mail; shouldCreateUser stays false since
      // the call above already created the user.
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: false, emailRedirectTo: AUTH_REDIRECT_URL },
      });
      if (otpError) {
        setError(getOtpErrorMessage(otpError) ?? "Something went wrong sending the link. Please try again.");
        return;
      }

      setSentEmail(targetEmail);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const mascotHeader = (
    <div className="card-header">
      <div className="mascot-circle">
        <Image src="/pip-instructor.png" alt="" width={621} height={793} priority />
      </div>
      <div>
        <div className="wordmark" style={{ justifyContent: "center" }}>
          <span className="wordmark-brand">ClearPass</span>
          <span className="wordmark-context">Instructors</span>
        </div>
        {!sentEmail && (
          <h1 style={{ marginTop: "0.6rem", fontWeight: 600, fontSize: "1rem", color: "var(--text-dark)" }}>
            Create your instructor account
          </h1>
        )}
      </div>
    </div>
  );

  if (sentEmail) {
    return (
      <main className="centered-shell">
        <div className="card">
          {mascotHeader}
          <CheckYourEmail email={sentEmail} onUseDifferentEmail={() => setSentEmail(null)} />
        </div>
      </main>
    );
  }

  return (
    <main className="centered-shell">
      <div className="card">
        {mascotHeader}

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

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
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Sending…" : "Create account"}
          </button>
          <p className="muted" style={{ margin: 0, textAlign: "center" }}>
            We&apos;ll email you a link to get started — no password needed.
          </p>
        </form>

        <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0, textAlign: "center" }}>
          Already have an account?{" "}
          <a href={ref ? `/login?ref=${encodeURIComponent(ref)}` : "/login"}>Sign in</a>
        </p>
      </div>
    </main>
  );
}
