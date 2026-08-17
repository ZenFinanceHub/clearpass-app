import { describe, expect, test } from "vitest";
import { getOtpErrorMessage, parseAuthRedirectError } from "./authErrors";

describe("parseAuthRedirectError", () => {
  test("null for an empty hash", () => {
    expect(parseAuthRedirectError("")).toBeNull();
  });

  test("null for a hash with no error params (e.g. a successful magic-link callback)", () => {
    expect(parseAuthRedirectError("#access_token=abc&refresh_token=def&type=magiclink")).toBeNull();
  });

  test("expired-link message for error_code=otp_expired", () => {
    expect(
      parseAuthRedirectError(
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
      )
    ).toBe("This link has expired or has already been used. Request a new one below.");
  });

  test("expired-link message for a plain access_denied with no error_code", () => {
    expect(parseAuthRedirectError("#error=access_denied&error_description=Access+denied")).toBe(
      "This link has expired or has already been used. Request a new one below."
    );
  });

  test("generic fallback message for an unrecognized error_code", () => {
    expect(parseAuthRedirectError("#error=server_error&error_code=unexpected_failure")).toBe(
      "Something went wrong with that link. Request a new one below."
    );
  });
});

describe("getOtpErrorMessage", () => {
  test("null when there is no error", () => {
    expect(getOtpErrorMessage(null)).toBeNull();
    expect(getOtpErrorMessage(undefined)).toBeNull();
  });

  test("the no-account message for otp_disabled — shouldCreateUser:false on an unregistered email", () => {
    expect(getOtpErrorMessage({ code: "otp_disabled", message: "Signups not allowed for otp" })).toBe(
      "No ClearPass instructor account found with that email."
    );
  });

  test("passes through Supabase's own rate-limit message unchanged — already clear to the user", () => {
    expect(
      getOtpErrorMessage({
        code: "over_email_send_rate_limit",
        message: "For security purposes, you can only request this after 35 seconds.",
      })
    ).toBe("For security purposes, you can only request this after 35 seconds.");
  });

  test("falls back to the raw message for any other error code", () => {
    expect(getOtpErrorMessage({ code: "unexpected_failure", message: "Error sending magic link email" })).toBe(
      "Error sending magic link email"
    );
  });
});
