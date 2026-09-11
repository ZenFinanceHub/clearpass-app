"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";
const SUPPORT_URL = "https://clearpass-app.vercel.app/contact";

type LicenceType = "adi" | "pdi";
export type Status = "loading" | "none" | "pending" | "verified" | "rejected";

type ApiResponse = {
  status: "none" | "pending" | "verified" | "rejected";
  licenceType: LicenceType | null;
  submittedAt: string | null;
  reviewNote: string | null;
};

function licenceTypeLabel(licenceType: LicenceType | null) {
  return licenceType === "pdi" ? "trainee (PDI)" : "ADI";
}

// Manual verification, evidence is a self-declared ADI or trainee (PDI)
// licence number — see GET/POST /api/instructor/verification in proxy.js.
// A fresh, non-duplicate submission auto-verifies instantly; a duplicate
// number or a resubmission after rejection needs a human, hence 'pending'.
//
// onStatusChange reports the resolved status up to the dashboard, which
// uses it to decide whether PayoutProofCard should render at all — that
// card is meaningless (and its own POST would 403) before verification.
export default function VerificationCard({ onStatusChange }: { onStatusChange?: (status: Status) => void }) {
  const [status, setStatus] = useState<Status>("loading");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [lastLicenceType, setLastLicenceType] = useState<LicenceType | null>(null);

  const [editing, setEditing] = useState(false);
  const [licenceType, setLicenceType] = useState<LicenceType>("adi");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/api/instructor/verification`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as ApiResponse;
      setStatus(body.status);
      onStatusChange?.(body.status);
      setSubmittedAt(body.submittedAt);
      setReviewNote(body.reviewNote);
      setLastLicenceType(body.licenceType);
      if (body.licenceType) setLicenceType(body.licenceType);
    } catch {
      // Leave status as-is — the card just won't render until the next
      // load (e.g. a page refresh); nothing here should block the rest of
      // the dashboard from rendering.
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired. Please sign in again.");
        return;
      }
      const res = await fetch(`${API_URL}/api/instructor/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ licenceType, licenceNumber, declaration }),
      });
      const body = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          declaration_required: "Please confirm the declaration below before submitting.",
          invalid_licence_number_characters: "Licence numbers can only contain letters, digits, spaces and hyphens.",
          licence_number_required: "Please enter your licence number.",
          licence_number_too_short: "That licence number looks too short — please check and try again.",
          licence_number_too_long: "That licence number looks too long — please check and try again.",
        };
        setError(messages[body.error] ?? "Could not submit. Please try again.");
        return;
      }
      setEditing(false);
      setLicenceNumber("");
      setDeclaration(false);
      await load();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return null;

  if (status === "verified") {
    return (
      <span className="badge badge-redeemed" style={{ marginBottom: "1rem" }}>
        You&apos;re verified, free Pro is on ✓
      </span>
    );
  }

  const showForm = status === "none" || editing;

  return (
    <div className="section-card">
      {status === "pending" && !editing && (
        <>
          <p style={{ margin: 0, fontWeight: 600 }}>We need to check a couple of details</p>
          <p className="muted" style={{ marginTop: "0.4rem" }}>
            We&apos;ll be in touch.
          </p>
          <p className="muted" style={{ marginTop: "0.4rem", fontSize: "0.85rem" }}>
            Submitted: {licenceTypeLabel(lastLicenceType)} licence
            {submittedAt ? ` on ${new Date(submittedAt).toLocaleDateString("en-GB")}` : ""}
          </p>
          <button className="btn-text" type="button" onClick={() => setEditing(true)} style={{ marginTop: "0.5rem" }}>
            Correct it
          </button>
        </>
      )}

      {status === "rejected" && !editing && (
        <>
          <p style={{ margin: 0, fontWeight: 600 }}>We couldn&apos;t verify that number</p>
          {reviewNote && (
            <p className="muted" style={{ marginTop: "0.4rem" }}>
              {reviewNote}
            </p>
          )}
          <button className="btn btn-primary" type="button" onClick={() => setEditing(true)} style={{ marginTop: "0.6rem" }}>
            Try again
          </button>
          <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.82rem" }}>
            Still stuck?{" "}
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              Contact support
            </a>
          </p>
        </>
      )}

      {showForm && (
        <form onSubmit={(e) => void handleSubmit(e)}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {status === "none" ? "Get free Pro: add your ADI or trainee licence number" : "Resubmit your licence number"}
          </p>
          <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.7rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 500 }}>
              <input
                type="radio"
                name="licenceType"
                checked={licenceType === "adi"}
                onChange={() => setLicenceType("adi")}
              />
              ADI
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 500 }}>
              <input
                type="radio"
                name="licenceType"
                checked={licenceType === "pdi"}
                onChange={() => setLicenceType("pdi")}
              />
              Trainee (PDI)
            </label>
          </div>
          <div className="field" style={{ marginTop: "0.7rem", marginBottom: 0 }}>
            <label htmlFor="licenceNumber">Licence number</label>
            <input
              id="licenceNumber"
              type="text"
              value={licenceNumber}
              onChange={(e) => {
                setLicenceNumber(e.target.value);
                setError("");
              }}
              required
              autoComplete="off"
            />
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.8rem", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={declaration}
              onChange={(e) => {
                setDeclaration(e.target.checked);
                setError("");
              }}
              style={{ marginTop: "0.15rem" }}
            />
            <span>
              I confirm I&apos;m a DVSA-registered ADI or trainee instructor (PDI). We may remove free Pro if we can&apos;t
              confirm this.
            </span>
          </label>
          {error && (
            <div className="error-banner" role="alert" style={{ marginTop: "0.6rem" }}>
              <span>{error}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.7rem", alignItems: "center" }}>
            <button className="btn btn-primary" type="submit" disabled={submitting || !declaration}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
            {editing && (
              <button type="button" className="btn-text" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
