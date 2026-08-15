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
      <main>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Payment received</h1>
      {seat ? (
        <>
          <p>Send this link to your learner. It works once.</p>
          <p
            style={{
              wordBreak: "break-all",
              background: "#fff",
              border: "1px solid var(--border)",
              padding: "0.75rem",
              borderRadius: 4,
            }}
          >
            {seatInviteLink(seat.invite_token)}
          </p>
          <button onClick={() => void handleCopy()}>{copied ? "Copied!" : "Copy invite link"}</button>
        </>
      ) : attempts >= MAX_ATTEMPTS ? (
        <>
          <p>Your payment went through, but the seat hasn&apos;t appeared yet. This can take a minute.</p>
          <button onClick={() => setAttempts(0)}>Check again</button>
        </>
      ) : (
        <p className="muted">Confirming your purchase…</p>
      )}
      <p>
        <Link href="/dashboard">Back to your seats</Link>
      </p>
    </main>
  );
}
