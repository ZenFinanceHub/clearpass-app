"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type InstructorAuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "not-instructor"; accessToken: string; instructorSignupIntent: boolean }
  | { status: "instructor"; userId: string; email: string | null };

// Checks session + profiles.account_type, used by every page that needs an
// authenticated instructor independently (a learner navigating straight to
// /dashboard by URL must be gated there too, not only on the entry page).
//
// Driven by onAuthStateChange rather than a one-shot getSession() call.
// getSession() in a useEffect races the client's own initialization
// (recovering a persisted session from storage) — harmless most of the
// time, but it showed up for real right after a full-page redirect back
// from Stripe Checkout to /purchase-success: the effect ran, getSession()
// resolved before storage recovery had finished, and the page concluded
// "unauthenticated" and bounced to /login even though the session was
// there all along. onAuthStateChange guarantees exactly one INITIAL_SESSION
// event once the client has fully finished initializing, whether that
// happens before or after this hook subscribes — Supabase's own docs
// specifically call this out as the correct pattern for "post-redirect
// events", which is exactly this case.
export function useInstructorAuth(): InstructorAuthState {
  const [state, setState] = useState<InstructorAuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function resolve(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ status: "unauthenticated" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if ((profile as { account_type?: string } | null)?.account_type !== "instructor") {
        // instructor_signup_intent is set server-side at account creation
        // (proxy.js's /api/instructor/signup) and rides in the JWT's
        // user_metadata claim, so it's already on the session — no extra
        // round trip needed to know whether a signup is in progress.
        setState({
          status: "not-instructor",
          accessToken: session.access_token,
          instructorSignupIntent:
            (session.user.user_metadata as { instructor_signup_intent?: boolean } | undefined)
              ?.instructor_signup_intent === true,
        });
        return;
      }

      setState({ status: "instructor", userId: session.user.id, email: session.user.email ?? null });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
