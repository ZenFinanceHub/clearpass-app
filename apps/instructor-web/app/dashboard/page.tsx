"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInstructorAuth } from "@/lib/useInstructorAuth";
import { supabase } from "@/lib/supabase";
import { seatInviteLink, type InstructorSeat } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";

export default function DashboardPage() {
  const auth = useInstructorAuth();
  const router = useRouter();
  const [seats, setSeats] = useState<InstructorSeat[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (auth.status === "not-instructor") {
      void supabase.auth.signOut();
      router.replace("/");
      return;
    }
    if (auth.status !== "instructor") return;

    let cancelled = false;
    // RLS scopes this to the signed-in instructor's own rows — no backend
    // endpoint needed to read.
    void (async () => {
      const { data, error } = await supabase
        .from("instructor_seats")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setSeats((data as InstructorSeat[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.status, router]);

  async function handleBuy() {
    setBuyError("");
    setBuying(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setBuyError("Your session expired. Please sign in again.");
        return;
      }
      const res = await fetch(`${API_URL}/api/instructor/seats/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        const message = body.error ?? "Could not start checkout. Please try again.";
        // The server's `detail` carries the actual cause (e.g. a Stripe
        // API error) — body.error alone is a fixed, generic string per
        // failure path (see proxy.js's /api/instructor/seats/purchase
        // catch block), so surfacing only that once cost a full
        // investigation for something the server had already diagnosed.
        setBuyError(body.detail ? `${message}: ${body.detail}` : message);
        return;
      }
      window.location.href = body.url;
    } catch {
      setBuyError("Could not start checkout. Please try again.");
    } finally {
      setBuying(false);
    }
  }

  async function handleCopy(seatId: string, token: string) {
    await navigator.clipboard.writeText(seatInviteLink(token));
    setCopiedId(seatId);
    setTimeout(() => setCopiedId((current) => (current === seatId ? null : current)), 2000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Learner seats</h1>
        <button onClick={() => void handleSignOut()}>Sign out</button>
      </div>

      <p>
        <button onClick={() => void handleBuy()} disabled={buying}>
          {buying ? "Starting checkout…" : "Buy a seat — £5.99"}
        </button>
      </p>
      {buyError && <p className="error">{buyError}</p>}

      {loadError && <p className="error">Could not load seats: {loadError}</p>}

      {seats === null ? (
        <p className="muted">Loading seats…</p>
      ) : seats.length === 0 ? (
        <p className="muted">No seats purchased yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Purchased</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {seats.map((seat) => (
              <tr key={seat.id}>
                <td>{new Date(seat.created_at).toLocaleDateString("en-GB")}</td>
                <td>
                  {seat.redeemed_at ? `Redeemed ${new Date(seat.redeemed_at).toLocaleDateString("en-GB")}` : "Unredeemed"}
                </td>
                <td>
                  {!seat.redeemed_at && (
                    <button onClick={() => void handleCopy(seat.id, seat.invite_token)}>
                      {copiedId === seat.id ? "Copied!" : "Copy invite link"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
