"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { APP_STORE_URL, PLAY_STORE_URL, STORE_LISTINGS_LIVE } from "@/lib/appStore";
import type { SeatStatusResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";

type SeatState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "redeemed" }
  | { kind: "check_failed" }
  | { kind: "ready"; instructorId: string; instructorName: string | null };

type RedemptionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; proExpiresAt: string }
  | { kind: "already_has_pro" }
  | { kind: "error"; message: string };

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Links this instructor to this learner as 'accepted' — the existing RLS
// gate on user_progress (schema.sql: "Instructors can read linked learner
// progress") keys off exactly this. No UNIQUE(instructor_id, learner_id)
// constraint exists on this table (it predates this flow, e.g. referral
// signups can leave a 'pending' row here already), so this is a manual
// select-then-write rather than an upsert with onConflict — there's no
// constraint for Postgres to conflict against.
async function upsertAcceptedRelationship(instructorId: string, learnerId: string, learnerEmail: string | null) {
  const { data: existing } = await supabase
    .from("instructor_relationships")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("learner_id", learnerId)
    .maybeSingle();

  if (existing) {
    await supabase.from("instructor_relationships").update({ status: "accepted" }).eq("id", (existing as { id: string }).id);
  } else {
    await supabase.from("instructor_relationships").insert({
      instructor_id: instructorId,
      learner_id: learnerId,
      learner_email: learnerEmail,
      status: "accepted",
    });
  }
}

export default function RedeemClient({ token }: { token: string }) {
  const session = useSession();
  const [seatState, setSeatState] = useState<SeatState>({ kind: "loading" });
  const [redemption, setRedemption] = useState<RedemptionState>({ kind: "idle" });

  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/seats/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setSeatState({ kind: "invalid" });
          return;
        }
        if (!res.ok) {
          setSeatState({ kind: "check_failed" });
          return;
        }
        const data = (await res.json()) as SeatStatusResponse;
        if (cancelled) return;
        if (!data.valid) {
          setSeatState({ kind: "invalid" });
          return;
        }
        if (data.redeemed) {
          setSeatState({ kind: "redeemed" });
          return;
        }
        setSeatState({ kind: "ready", instructorId: data.instructorId, instructorName: data.instructorName });
      } catch {
        if (!cancelled) setSeatState({ kind: "check_failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setAuthError(error.message);
          return;
        }
        const userId = data.session?.user?.id ?? data.user?.id;
        if (userId) {
          // Permissive INSERT policy on profiles (schema.sql: "fix sign-up
          // timing issue") allows this even before email confirmation
          // completes, when there is no session yet — same pattern
          // apps/mobile/app/auth/signup.tsx relies on.
          await supabase.from("profiles").insert({ id: userId, account_type: "learner" });
        }
        if (!data.session) {
          setAwaitingConfirmation(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setAuthError(error.message);
          return;
        }
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleConsent(consented: boolean) {
    if (session.status !== "signed-in" || seatState.kind !== "ready") return;
    const { instructorId } = seatState;
    setRedemption({ kind: "submitting" });

    try {
      const res = await fetch(`${API_URL}/api/seats/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();

      if (res.ok && body.redeemed) {
        // Consent is only recorded once the seat is actually, successfully
        // redeemed — an orphaned consent/relationship row for a redemption
        // that failed or lost a race would be worse than recording nothing.
        await supabase.from("progress_sharing_consent").upsert(
          { learner_id: session.userId, instructor_id: instructorId, consented },
          { onConflict: "learner_id,instructor_id" }
        );
        if (consented) {
          await upsertAcceptedRelationship(instructorId, session.userId, session.email);
        }
        setRedemption({ kind: "success", proExpiresAt: body.proExpiresAt });
        return;
      }

      if (res.ok && body.redeemed === false && body.reason === "already_has_pro") {
        setRedemption({ kind: "already_has_pro" });
        return;
      }

      if (res.status === 409) {
        setSeatState({ kind: "redeemed" });
        setRedemption({ kind: "idle" });
        return;
      }

      setRedemption({ kind: "error", message: "Something went wrong claiming your seat. Please try again." });
    } catch {
      setRedemption({ kind: "error", message: "Something went wrong claiming your seat. Please try again." });
    }
  }

  // margin: "0 auto" centers this standalone — .mascot-circle is a
  // display:flex block box with a fixed width, which margin:auto centers
  // like any other block element. Redundant (harmless) inside .card-header,
  // which already centers its children via flexbox.
  const mascot = (
    <div className="mascot-circle" style={{ margin: "0 auto" }}>
      <Image src="/pip-instructor.png" alt="" width={621} height={793} priority />
    </div>
  );

  if (seatState.kind === "loading") {
    return (
      <main className="centered-shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (seatState.kind === "invalid") {
    return (
      <main className="centered-shell">
        <div className="card" style={{ textAlign: "center" }}>
          {mascot}
          <h1 style={{ marginTop: "1rem" }}>This link isn&apos;t valid</h1>
          <p className="muted">Double-check the link, or ask for a new one.</p>
        </div>
      </main>
    );
  }

  if (seatState.kind === "check_failed") {
    return (
      <main className="centered-shell">
        <div className="card" style={{ textAlign: "center" }}>
          {mascot}
          <h1 style={{ marginTop: "1rem" }}>Couldn&apos;t load this page</h1>
          <p className="muted">Check your connection and try again.</p>
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (seatState.kind === "redeemed") {
    return (
      <main className="centered-shell">
        <div className="card" style={{ textAlign: "center" }}>
          {mascot}
          <h1 style={{ marginTop: "1rem" }}>This link has already been used</h1>
          <p className="muted">If that doesn&apos;t sound right, ask whoever sent it for a new link.</p>
        </div>
      </main>
    );
  }

  if (redemption.kind === "already_has_pro") {
    return (
      <main className="centered-shell">
        <div className="card" style={{ textAlign: "center" }}>
          {mascot}
          <h1 style={{ marginTop: "1rem" }}>You&apos;re already set up</h1>
          <p className="muted">Your account already has full ClearPass Pro access — there&apos;s nothing more to do.</p>
        </div>
      </main>
    );
  }

  if (redemption.kind === "success") {
    return (
      <main className="centered-shell">
        <div className="card" style={{ textAlign: "center" }}>
          {mascot}
          <h1 style={{ marginTop: "1rem" }}>You&apos;ve got ClearPass Pro</h1>
          <p className="muted">Your Pro access runs until {formatExpiry(redemption.proExpiresAt)}.</p>

          <div style={{ marginTop: "1.5rem" }}>
            {STORE_LISTINGS_LIVE ? (
              <>
                <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Get the app and sign in with the same email and password</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <a className="btn btn-primary btn-block" href={APP_STORE_URL}>
                    Download on the App Store
                  </a>
                  <a className="btn btn-secondary btn-block" href={PLAY_STORE_URL}>
                    Get it on Google Play
                  </a>
                </div>
              </>
            ) : (
              <div className="info-box" style={{ textAlign: "left" }}>
                The ClearPass app is coming very soon to the App Store and Google Play. As soon as it&apos;s live, download it and
                sign in with the same email and password you just used here — your Pro access will be waiting for you.
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // seatState.kind === "ready" from here on.
  const invitedBy = seatState.instructorName ? `${seatState.instructorName} has ` : "You've been ";

  if (session.status === "loading") {
    return (
      <main className="centered-shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (session.status === "signed-in") {
    return (
      <main className="centered-shell">
        <div className="card">
          <div className="card-header">
            {mascot}
            <h1>Sharing your progress</h1>
          </div>

          <p style={{ color: "var(--text-dark)", lineHeight: 1.5 }}>
            Your instructor will be able to see how you&apos;re getting on — your practice scores, mock test results, and which
            topics you find tricky.
          </p>

          {redemption.kind === "error" && (
            <div className="error-banner" role="alert">
              <span>{redemption.message}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1.25rem" }}>
            <button
              className="btn btn-primary btn-block"
              disabled={redemption.kind === "submitting"}
              onClick={() => void handleConsent(true)}
            >
              {redemption.kind === "submitting" ? "One moment…" : "Share my progress"}
            </button>
            <button
              className="btn btn-secondary btn-block"
              disabled={redemption.kind === "submitting"}
              onClick={() => void handleConsent(false)}
            >
              {redemption.kind === "submitting" ? "One moment…" : "Don't share my progress"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.8rem", textAlign: "center" }}>
            Either way, you&apos;ll get your ClearPass Pro access. You can change this later.
          </p>
        </div>
      </main>
    );
  }

  if (awaitingConfirmation) {
    return (
      <main className="centered-shell">
        <div className="card" style={{ textAlign: "center" }}>
          {mascot}
          <h1 style={{ marginTop: "1rem" }}>Check your inbox</h1>
          <p className="muted">
            We sent a verification link to <strong style={{ color: "var(--text-dark)" }}>{email.trim()}</strong>. Tap it, then come
            back here and sign in below.
          </p>
          <button
            className="btn btn-secondary btn-block"
            style={{ marginTop: "1rem" }}
            onClick={() => {
              setAwaitingConfirmation(false);
              setAuthMode("signin");
              setPassword("");
            }}
          >
            I&apos;ve confirmed — sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="centered-shell">
      <div className="card">
        <div className="card-header">
          {mascot}
          <div>
            <h1>{invitedBy}given you ClearPass Pro</h1>
            <p className="muted" style={{ marginTop: "0.4rem" }}>
              90 days free — hazard perception, mock tests, and more.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleAuthSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
              minLength={6}
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {authError && (
            <div className="error-banner" role="alert">
              <span>{authError}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={authSubmitting}>
            {authSubmitting ? "One moment…" : authMode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0, textAlign: "center" }}>
          {authMode === "signup" ? (
            <>
              Already have a ClearPass account?{" "}
              <button className="btn-text" style={{ padding: 0 }} onClick={() => setAuthMode("signin")}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New to ClearPass?{" "}
              <button className="btn-text" style={{ padding: 0 }} onClick={() => setAuthMode("signup")}>
                Create an account
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
