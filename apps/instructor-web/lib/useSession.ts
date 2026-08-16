"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type SessionState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "signed-in"; userId: string; email: string | null; accessToken: string };

// Driven by onAuthStateChange, not a one-shot getSession() — same reasoning
// as useInstructorAuth.ts (see its comment for the incident this pattern
// fixed: a one-shot getSession() call can race the client's own
// storage-recovery step). This page is reached straight out of a WhatsApp
// in-app browser, which is exactly the kind of environment where that race
// is likeliest to bite, so the same fix applies here even though there is
// no post-Stripe-redirect involved this time.
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!session) {
        setState({ status: "none" });
      } else {
        setState({
          status: "signed-in",
          userId: session.user.id,
          email: session.user.email ?? null,
          accessToken: session.access_token,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
