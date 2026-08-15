"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
        // The server's `detail` carries the actual cause (e.g. a Stripe API
        // error) — body.error alone is a fixed, generic string per failure
        // path (see proxy.js's /api/instructor/seats/purchase catch block).
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
        <button className="btn-text" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </header>

      <main>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <h1>Learner seats</h1>
          <button className="btn btn-primary" onClick={() => void handleBuy()} disabled={buying}>
            {buying ? "Starting checkout…" : "Buy a seat — £5.99"}
          </button>
        </div>

        {buyError && (
          <div className="error-banner" role="alert">
            <span>{buyError}</span>
          </div>
        )}
        {loadError && (
          <div className="error-banner" role="alert">
            <span>Could not load seats: {loadError}</span>
          </div>
        )}

        {seats === null ? (
          <p className="muted">Loading seats…</p>
        ) : seats.length === 0 ? (
          <div className="empty-state">
            <div className="mascot-circle-small">
              <Image src="/pip-neutral.png" alt="" width={240} height={288} />
            </div>
            <p style={{ margin: 0, fontWeight: 600 }}>No seats yet</p>
            <p className="muted" style={{ margin: 0 }}>
              Buy a seat above to get an invite link you can send to a learner.
            </p>
          </div>
        ) : (
          <table className="seats-table">
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
                    {seat.redeemed_at ? (
                      <span className="badge badge-redeemed">
                        Redeemed {new Date(seat.redeemed_at).toLocaleDateString("en-GB")}
                      </span>
                    ) : (
                      <span className="badge badge-unredeemed">Unredeemed</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    {!seat.redeemed_at && (
                      <button
                        className={`btn btn-secondary${copiedId === seat.id ? " is-copied" : ""}`}
                        onClick={() => void handleCopy(seat.id, seat.invite_token)}
                      >
                        {copiedId === seat.id ? "Copied ✓" : "Copy invite link"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
