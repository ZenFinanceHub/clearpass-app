"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInstructorAuth } from "@/lib/useInstructorAuth";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const auth = useInstructorAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    } else if (auth.status === "instructor") {
      router.replace("/dashboard");
    } else if (auth.status === "not-instructor") {
      // Do not silently allow a learner through — sign them out rather
      // than leave an authenticated-but-wrong-role session sitting here.
      void supabase.auth.signOut();
    }
  }, [auth.status, router]);

  if (auth.status === "not-instructor") {
    return (
      <main>
        <h1>This tool is for instructors only</h1>
        <p>
          Your account isn&apos;t set up as an instructor account, so you&apos;ve been signed out.
          If you believe this is a mistake, contact support.
        </p>
      </main>
    );
  }

  return (
    <main>
      <p className="muted">Loading…</p>
    </main>
  );
}
