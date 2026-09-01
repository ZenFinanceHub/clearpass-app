"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTH_REDIRECT_URL, authRedirectHash, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { getOtpErrorMessage, parseAuthRedirectError } from "@/lib/authErrors";
import CheckYourEmail from "@/components/CheckYourEmail";

type Mode = "link" | "password";
type View = "form" | "sent";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="centered-shell">
          <p className="muted">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [mode, setMode] = useState<Mode>("link");
  const [view, setView] = useState<View>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Seeded from the raw redirect hash (captured before Supabase's client
  // init consumes it) so an expired/already-used magic link shows a message
  // immediately, on first render — not one render later.
  const [error, setError] = useState<string | null>(() => parseAuthRedirectError(authRedirectHash));
  const [submitting, setSubmitting] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");

  // Signed in already (fresh page load with a persisted session, or the
  // full-page navigation a clicked magic link causes) — hand off to / to
  // run the instructor-vs-learner gate, same as the password path below.
  // onAuthStateChange-driven (via useSession), not a one-shot getSession():
  // a magic-link click is a full-page navigation, and a one-shot call can
  // resolve before the client finishes recovering the session it just
  // parsed from the URL — the exact race that broke the post-Stripe
  // redirect previously.
  useEffect(() => {
    if (session.status === "signed-in") {
      router.replace("/");
    }
  }, [session.status, router]);

  async function sendMagicLink(targetEmail: string) {
    setError(null);
    setSubmitting(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        // A mistyped address must not silently create a fresh, empty
        // account — it must tell the instructor no account exists.
        shouldCreateUser: false,
        emailRedirectTo: AUTH_REDIRECT_URL,
      },
    });
    setSubmitting(false);
    if (otpError) {
      setError(getOtpErrorMessage(otpError));
      return;
    }
    setSentToEmail(targetEmail);
    setView("sent");
  }

  async function handleLinkSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMagicLink(email.trim());
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace("/");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  function useDifferentEmail() {
    setView("form");
    setMode("link");
    setError(null);
  }

  if (session.status === "loading" || session.status === "signed-in") {
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
            <Image src="/pip-instructor.png" alt="" width={621} height={793} priority />
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

        {view === "sent" ? (
          <CheckYourEmail email={sentToEmail} onUseDifferentEmail={useDifferentEmail} />
        ) : (
          <>
            <div className="mode-toggle" role="tablist" aria-label="Sign-in method">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "link"}
                className={mode === "link" ? "is-active" : ""}
                onClick={() => switchMode("link")}
              >
                Email link
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "password"}
                className={mode === "password" ? "is-active" : ""}
                onClick={() => switchMode("password")}
              >
                Password
              </button>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
              </div>
            )}

            {mode === "link" ? (
              <form onSubmit={handleLinkSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                  {submitting ? "Sending…" : "Send sign-in link"}
                </button>
                <p className="muted" style={{ margin: 0, textAlign: "center" }}>
                  We&apos;ll email you a link — no password needed.
                </p>
              </form>
            ) : (
              <form
                onSubmit={handlePasswordSubmit}
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
              >
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
                <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0, textAlign: "center" }}>
              Use the same email as your ClearPass mobile app account.
            </p>
            <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0, textAlign: "center" }}>
              New here?{" "}
              <a href={ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup"}>Create an instructor account</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
