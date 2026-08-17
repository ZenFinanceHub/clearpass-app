// Supabase's magic-link callback redirects here with the outcome in the URL
// fragment, not a query string — an expired or already-used link comes back
// as e.g. "#error=access_denied&error_code=otp_expired&error_description=...".
// Read this from the raw hash captured in lib/supabase.ts (before Supabase's
// own client init consumes and clears it), not from window.location directly.
export function parseAuthRedirectError(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const error = params.get("error");
  const errorCode = params.get("error_code");
  if (!error && !errorCode) return null;

  if (errorCode === "otp_expired" || error === "access_denied") {
    return "This link has expired or has already been used. Request a new one below.";
  }
  return "Something went wrong with that link. Request a new one below.";
}

// Supabase's own error shape for auth calls (AuthApiError): `.code` is the
// stable machine-readable error_code, `.message` is its (not always
// user-facing) description.
export function getOtpErrorMessage(error: { code?: string; message: string } | null | undefined): string | null {
  if (!error) return null;
  // shouldCreateUser:false + an email with no account — see the "no ClearPass
  // instructor account found" requirement. Supabase's own message here
  // ("Signups not allowed for otp") reads like a config problem, not a typo,
  // so it's replaced rather than passed through.
  if (error.code === "otp_disabled") {
    return "No ClearPass instructor account found with that email.";
  }
  return error.message;
}
