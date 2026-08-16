"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInstructorAuth } from "@/lib/useInstructorAuth";
import { supabase } from "@/lib/supabase";
import { seatInviteLink, type InstructorSeat } from "@/lib/types";

// The webhook that mints the seat runs asynchronously and can lag a moment
// behind the browser's redirect back from Stripe, so this polls briefly
// rather than assuming the row exists the instant the page loads.
const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 10;

export default function PurchaseSuccessPage() {
  const auth = useInstructorAuth();
  const router = useRouter();
  const [seat, setSeat] = useState<InstructorSeat | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [copied, setCopied] = useState(false);
  const mountedAt = useRef(new Date().toISOString());

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    } else if (auth.status === "not-instructor") {
      void supabase.auth.signOut();
      router.replace("/");
    }
  }, [auth.status, router]);

  useEffect(() => {
    if (auth.status !== "instructor" || seat || attempts >= MAX_ATTEMPTS) return;

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("instructor_seats")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const latest = data as InstructorSeat | null;
      if (latest && latest.created_at >= mountedAt.current) {
        setSeat(latest);
      } else {
        setAttempts((n) => n + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [auth.status, seat, attempts]);

  async function handleCopy() {
    if (!seat) return;
    await navigator.clipboard.writeText(seatInviteLink(seat.invite_token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (auth.status !== "instructor") {
    return (
      <main className="centered-shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <div className="page-shell">
      <header className="app-header">
        <div className="wordmark">
          <span className="wordmark-brand">ClearPass</span>
          <span className="wordmark-context">Instructors</span>
        </div>
      </header>

      <main className="centered-shell" style={{ minHeight: "auto", padding: "2rem 0" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <h1 style={{ marginBottom: "0.75rem" }}>Payment received</h1>

          {seat ? (
            <>
              <p className="muted" style={{ marginBottom: 0 }}>
                Send this link to your learner. It works once.
              </p>
              <div className="invite-link-box">{seatInviteLink(seat.invite_token)}</div>
              <button className={`btn btn-secondary btn-block${copied ? " is-copied" : ""}`} onClick={() => void handleCopy()}>
                {copied ? "Copied ✓" : "Copy invite link"}
              </button>
              <p className="muted" style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.85rem" }}>
                Once your learner redeems this invite, they&apos;ll appear in the ClearPass mobile app — that&apos;s where
                you&apos;ll see their progress, readiness score and mock test results.
              </p>
            </>
          ) : attempts >= MAX_ATTEMPTS ? (
            <>
              <p className="muted">Your payment went through, but the seat hasn&apos;t appeared yet. This can take a minute.</p>
              <button className="btn btn-secondary btn-block" onClick={() => setAttempts(0)}>
                Check again
              </button>
            </>
          ) : (
            <p className="muted">Confirming your purchase…</p>
          )}

          <p style={{ marginTop: "1.5rem", marginBottom: 0 }}>
            <Link href="/dashboard" style={{ color: "var(--indigo)", fontWeight: 600, fontSize: "0.9rem" }}>
              Back to your seats
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
