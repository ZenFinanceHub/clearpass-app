"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type InstructorAuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "not-instructor" }
  | { status: "instructor"; userId: string; email: string | null };

// Checks session + profiles.account_type on mount. Every page that needs an
// authenticated instructor uses this directly rather than trusting an
// earlier page already checked — a learner (or a signed-out visitor)
// navigating straight to /dashboard by URL must be gated there too, not
// only on the entry page.
export function useInstructorAuth(): InstructorAuthState {
  const [state, setState] = useState<InstructorAuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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
        setState({ status: "not-instructor" });
        return;
      }

      setState({ status: "instructor", userId: session.user.id, email: session.user.email ?? null });
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
