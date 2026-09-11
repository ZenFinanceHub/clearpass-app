"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

type Status = "loading" | "none" | "pending_review" | "approved" | "rejected";

type ApiResponse = {
  status: "none" | "pending_review" | "approved" | "rejected";
  reviewNote: string | null;
};

// Shown only once verified (the dashboard mounts this conditionally on
// VerificationCard's status) — required before an instructor's first
// payout. See POST/GET /api/instructor/payout-proof in proxy.js: one
// photo/scan of an ADI certificate or trainee licence, checked by Claude
// against what was declared at verification, auto-approved only when it
// clearly matches; anything else needs Craig to review it by hand.
export default function PayoutProofCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/api/instructor/payout-proof`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as ApiResponse;
      setStatus(body.status);
      setReviewNote(body.reviewNote);
    } catch {
      // Leave status as-is — nothing here should block the rest of the
      // dashboard from rendering.
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("That file is larger than 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired. Please sign in again.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/instructor/payout-proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          not_verified: "Your account needs to be verified first.",
          unsupported_file: "Please upload a JPEG, PNG, WebP, PDF or HEIC file, up to 10 MB.",
          file_too_large: "That file is larger than 10 MB.",
          heic_conversion_failed: "Could not process that photo — please upload a JPEG, PNG, WebP or PDF instead.",
        };
        setError(body.message ?? messages[body.error] ?? "Could not upload. Please try again.");
        return;
      }
      await load();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  if (status === "loading") return null;

  if (status === "approved") {
    return (
      <span className="badge badge-redeemed" style={{ marginBottom: "1rem" }}>
        Payouts unlocked ✓
      </span>
    );
  }

  if (status === "pending_review") {
    return (
      <div className="section-card">
        <p style={{ margin: 0, fontWeight: 600 }}>Thanks, we&apos;re checking your document</p>
        <p className="muted" style={{ marginTop: "0.4rem" }}>
          We&apos;ll let you know once payouts are unlocked.
        </p>
      </div>
    );
  }

  return (
    <div className="section-card">
      <p style={{ margin: 0, fontWeight: 600 }}>Unlock payouts</p>
      <p className="muted" style={{ marginTop: "0.4rem" }}>
        Upload a photo of your ADI certificate or trainee licence.
      </p>
      {status === "rejected" && reviewNote && (
        <p className="muted" style={{ marginTop: "0.4rem" }}>
          {reviewNote}
        </p>
      )}
      <label
        className="btn btn-primary"
        style={{
          display: "inline-block",
          marginTop: "0.7rem",
          cursor: uploading ? "default" : "pointer",
          opacity: uploading ? 0.7 : 1,
        }}
      >
        {uploading ? "Uploading…" : status === "rejected" ? "Try again" : "Choose a file"}
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(e) => void handleFileChange(e)}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>
      {error && (
        <div className="error-banner" role="alert" style={{ marginTop: "0.6rem" }}>
          <span>{error}</span>
        </div>
      )}
      <p className="muted" style={{ marginTop: "0.7rem", fontSize: "0.8rem" }}>
        Stored privately and only used to confirm your registration.
      </p>
    </div>
  );
}
