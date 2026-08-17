"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authRedirectHash, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { getOtpErrorMessage, parseAuthRedirectError } from "@/lib/authErrors";

const RESEND_COOLDOWN_SECONDS = 30;

type Mode = "link" | "password";
type View = "form" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();

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
  const [resendCooldown, setResendCooldown] = useState(0);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function sendMagicLink(targetEmail: string) {
    setError(null);
    setSubmitting(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        // A mistyped address must not silently create a fresh, empty
        // account — it must tell the instructor no account exists.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setSubmitting(false);
    if (otpError) {
      setError(getOtpErrorMessage(otpError));
      return;
    }
    setSentToEmail(targetEmail);
    setView("sent");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
    setResendCooldown(0);
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
          <>
            <div className="success-banner" role="status">
              <span>
                We sent a sign-in link to <strong>{sentToEmail}</strong>. Open it on this device to continue —
                you can close this tab afterwards.
              </span>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                disabled={submitting || resendCooldown > 0}
                onClick={() => sendMagicLink(sentToEmail)}
              >
                {resendCooldown > 0 ? `Resend link (${resendCooldown}s)` : "Resend link"}
              </button>
              <button type="button" className="btn-text" onClick={useDifferentEmail}>
                Use a different email
              </button>
            </div>
          </>
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
          </>
        )}
      </div>
    </main>
  );
}
