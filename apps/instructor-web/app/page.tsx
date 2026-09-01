"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInstructorAuth } from "@/lib/useInstructorAuth";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";

const RECOVERY_LINK = (
  <a href="mailto:hello@getclearpass.co.uk?subject=Instructor%20signup%20issue">hello@getclearpass.co.uk</a>
);

// "idle" also covers the in-flight completion request — there is no separate
// "completing" phase, since setting one synchronously at the top of the
// effect (before the async work starts) would trigger an extra render pass
// for no benefit; the UI can't tell the two apart anyway.
type CompletionState =
  | { phase: "idle" }
  | { phase: "retryable"; message: string }
  | { phase: "terminal"; message: string };

export default function HomePage() {
  const auth = useInstructorAuth();
  const router = useRouter();
  const [completion, setCompletion] = useState<CompletionState>({ phase: "idle" });

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (auth.status === "instructor") {
      router.replace("/dashboard");
      return;
    }
    if (auth.status !== "not-instructor") return;

    if (!auth.instructorSignupIntent) {
      // Genuinely wrong-role session, no signup in progress — sign out as
      // before, just local-scoped so it doesn't revoke the mobile app too.
      void supabase.auth.signOut({ scope: "local" });
      return;
    }

    if (completion.phase !== "idle") return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/instructor/complete-signup`, {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        if (cancelled) return;

        if (res.ok) {
          router.replace("/dashboard");
          return;
        }

        const body: { error?: string } = await res.json().catch(() => ({}));

        if (res.status === 409 && body.error === "account_is_learner") {
          // The only response that proves this account is genuinely
          // ineligible — everything else below is treated as transient.
          await supabase.auth.signOut({ scope: "local" });
          if (!cancelled) {
            setCompletion({
              phase: "terminal",
              message: "This email address already has a learner account, so it can't sign up as an instructor.",
            });
          }
          return;
        }

        if (!cancelled) {
          setCompletion({
            phase: "retryable",
            message:
              res.status === 429
                ? "Too many attempts — please wait a moment and try again."
                : "Something went wrong finishing your signup.",
          });
        }
      } catch {
        if (!cancelled) {
          setCompletion({
            phase: "retryable",
            message: "Could not reach the server. Check your connection and try again.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, completion.phase, router]);

  if (auth.status === "not-instructor") {
    if (!auth.instructorSignupIntent || completion.phase === "terminal") {
      return (
        <main className="centered-shell">
          <div className="card" style={{ textAlign: "center" }}>
            <h1 style={{ marginBottom: "0.75rem" }}>This tool is for instructors only</h1>
            <div className="error-banner" style={{ textAlign: "left" }} role="alert">
              <span>
                {completion.phase === "terminal"
                  ? completion.message
                  : "Your account isn't set up as an instructor account, so you've been signed out."}{" "}
                If you believe this is a mistake, email {RECOVERY_LINK}.
              </span>
            </div>
          </div>
        </main>
      );
    }

    if (completion.phase === "retryable") {
      return (
        <main className="centered-shell">
          <div className="card" style={{ textAlign: "center" }}>
            <h1 style={{ marginBottom: "0.75rem" }}>Couldn&apos;t finish setting up your account</h1>
            <div className="error-banner" style={{ textAlign: "left" }} role="alert">
              <span>{completion.message}</span>
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
              onClick={() => setCompletion({ phase: "idle" })}
            >
              Try again
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="centered-shell">
        <p className="muted">Setting up your account…</p>
      </main>
    );
  }

  return (
    <main className="centered-shell">
      <p className="muted">Loading…</p>
    </main>
  );
}
