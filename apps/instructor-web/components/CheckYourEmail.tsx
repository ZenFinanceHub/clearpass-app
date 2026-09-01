"use client";

import { useEffect, useState } from "react";
import { supabase, AUTH_REDIRECT_URL } from "@/lib/supabase";
import { getOtpErrorMessage } from "@/lib/authErrors";

const RESEND_COOLDOWN_SECONDS = 30;

// Shared by /login and /signup — both reach this the same way (a magic link
// just got sent to an address that already has an auth user by this point),
// so there is exactly one "check your email" view rather than two.
export default function CheckYourEmail({
  email,
  onUseDifferentEmail,
}: {
  email: string;
  onUseDifferentEmail: () => void;
}) {
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    setError(null);
    setResending(true);
    // shouldCreateUser stays false — this view is only ever reached after
    // an account already exists, so a resend must never mint a new one.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: AUTH_REDIRECT_URL },
    });
    setResending(false);
    if (otpError) {
      setError(getOtpErrorMessage(otpError));
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <>
      <div className="success-banner" role="status">
        <span>
          We sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue — you can close
          this tab afterwards.
        </span>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={resending || cooldown > 0}
          onClick={() => void handleResend()}
        >
          {cooldown > 0 ? `Resend link (${cooldown}s)` : "Resend link"}
        </button>
        <button type="button" className="btn-text" onClick={onUseDifferentEmail}>
          Use a different email
        </button>
      </div>
    </>
  );
}
