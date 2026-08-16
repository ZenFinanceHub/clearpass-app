"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useInstructorAuth } from "@/lib/useInstructorAuth";
import { supabase } from "@/lib/supabase";
import { seatInviteLink, type InstructorSeat } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";
const MAX_DISPLAY_NAME_LENGTH = 60;

export default function DashboardPage() {
  const auth = useInstructorAuth();
  const router = useRouter();
  const [seats, setSeats] = useState<InstructorSeat[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [displayNameLoaded, setDisplayNameLoaded] = useState(false);
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);
  const [displayNameError, setDisplayNameError] = useState("");

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

  const instructorId = auth.status === "instructor" ? auth.userId : null;

  useEffect(() => {
    if (!instructorId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("profiles").select("display_name").eq("id", instructorId).maybeSingle();
      if (cancelled) return;
      if (!error) {
        setDisplayName((data as { display_name?: string | null } | null)?.display_name ?? "");
      }
      setDisplayNameLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [instructorId]);

  async function handleSaveDisplayName(e: FormEvent) {
    e.preventDefault();
    if (auth.status !== "instructor") return;
    setDisplayNameError("");
    setDisplayNameSaved(false);

    // Trimmed client-side, and an all-whitespace value is saved as null
    // (falls through to username/generic) rather than as an empty string,
    // which would otherwise render as a blank business name.
    const trimmed = displayName.trim();
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      setDisplayNameError(
        `Business name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer (currently ${trimmed.length}).`
      );
      return;
    }

    setDisplayNameSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed || null })
        .eq("id", auth.userId);
      if (error) {
        setDisplayNameError("Could not save. Please try again.");
        return;
      }
      setDisplayName(trimmed);
      setDisplayNameSaved(true);
      setTimeout(() => setDisplayNameSaved(false), 2000);
    } finally {
      setDisplayNameSaving(false);
    }
  }

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
        <div className="section-card">
          <form onSubmit={(e) => void handleSaveDisplayName(e)}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="displayName">Business name</label>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setDisplayNameError("");
                  }}
                  placeholder="e.g. Dave's Driving School"
                  disabled={!displayNameLoaded}
                  style={{ flex: "1 1 240px" }}
                />
                <button className="btn btn-primary" type="submit" disabled={displayNameSaving || !displayNameLoaded}>
                  {displayNameSaving ? "Saving…" : displayNameSaved ? "Saved ✓" : "Save"}
                </button>
              </div>
              <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.82rem" }}>
                This is what learners see when you send them a Pro invite.
              </p>
            </div>
          </form>
          {displayNameError && (
            <div className="error-banner" role="alert" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              <span>{displayNameError}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <h1>Learner seats</h1>
          <button className="btn btn-primary" onClick={() => void handleBuy()} disabled={buying}>
            {buying ? "Starting checkout…" : "Buy a seat — £5.99"}
          </button>
        </div>

        <p className="muted" style={{ marginBottom: "1.25rem" }}>
          Once a learner redeems their invite, they&apos;ll appear in the ClearPass mobile app — that&apos;s where you&apos;ll see
          their progress, readiness score and mock test results.
        </p>

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
              <Image src="/pip-instructor.png" alt="" width={621} height={793} />
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
