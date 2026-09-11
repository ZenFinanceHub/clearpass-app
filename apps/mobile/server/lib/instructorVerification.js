'use strict';

// Supports POST/GET /api/instructor/verification (see proxy.js) and the
// instructor_verification_requests table (see its migration). Manual
// verification: evidence is an ADI or trainee (PDI) licence number only,
// checked by a human (Craig, via admin.verify_instructor/reject_instructor
// in the SQL Editor) — nothing here calls out to DVSA or any register.

const LICENCE_NUMBER_CHARSET_RE = /^[A-Za-z0-9 -]+$/;
const LICENCE_TYPES = ['adi', 'pdi'];

function licenceTypeLabel(licenceType) {
  return licenceType === 'adi' ? 'ADI' : 'Trainee';
}

// Validates and normalises a submitted licence number. Both the raw value
// (as typed) and the normalised value (uppercase, spaces/hyphens stripped)
// are kept — normalised is what duplicate-number matching and the length
// check use; raw is what's shown back to the instructor and posted to
// Slack, since DVSA doesn't publish one fixed format for ADI/PDI badge
// numbers and reformatting someone's own number back at them would be
// confusing, not reassuring.
function validateLicenceSubmission({ licenceType, licenceNumber }) {
  if (!LICENCE_TYPES.includes(licenceType)) {
    return { ok: false, error: 'invalid_licence_type' };
  }
  const trimmed = typeof licenceNumber === 'string' ? licenceNumber.trim() : '';
  if (!trimmed) {
    return { ok: false, error: 'licence_number_required' };
  }
  if (!LICENCE_NUMBER_CHARSET_RE.test(trimmed)) {
    return { ok: false, error: 'invalid_licence_number_characters' };
  }
  const licenceNumberNormalised = trimmed.toUpperCase().replace(/[ -]/g, '');
  if (licenceNumberNormalised.length < 4) {
    return { ok: false, error: 'licence_number_too_short' };
  }
  if (licenceNumberNormalised.length > 12) {
    return { ok: false, error: 'licence_number_too_long' };
  }
  return { ok: true, licenceNumber: trimmed, licenceNumberNormalised };
}

// Slack only when this is a new request or its type/number genuinely
// changed — resubmitting identical details (a page reload double-post, or
// just re-saving the same number) must not re-alert.
function shouldNotifySubmission(existingRequest, { licenceType, licenceNumberNormalised }) {
  if (!existingRequest) return true;
  return (
    existingRequest.licence_type !== licenceType ||
    existingRequest.licence_number_normalised !== licenceNumberNormalised
  );
}

function formatVerificationSubmittedSlackMessage({ displayName, licenceType, licenceNumber, userId, duplicate }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  const lines = [
    `Instructor to verify: ${name}, ${licenceTypeLabel(licenceType)} ${licenceNumber}, user ${userId}`,
    `select admin.verify_instructor('${userId}');`,
    `select admin.reject_instructor('${userId}', 'reason');`,
  ];
  if (duplicate) {
    lines.push(`Warning: same licence number already on file for user ${duplicate.userId} (status: ${duplicate.status})`);
  }
  return lines.join('\n');
}

// GET /api/instructor/verification's status. instructor_verifications (not
// this request's own status column) is the source of truth for "verified"
// — the grandfathered test accounts, and any future manual comp grant,
// have a row there with no instructor_verification_requests row at all, so
// trusting the request's status field alone would report them as 'none'.
function resolveVerificationStatus({ isVerified, request }) {
  if (isVerified) {
    return {
      status: 'verified',
      licenceType: request ? request.licence_type : null,
      submittedAt: request ? request.submitted_at : null,
      reviewNote: null,
    };
  }
  if (!request) {
    return { status: 'none', licenceType: null, submittedAt: null, reviewNote: null };
  }
  return {
    status: request.status,
    licenceType: request.licence_type,
    submittedAt: request.submitted_at,
    reviewNote: request.review_note,
  };
}

// Whether a payout can be requested: only once a human has actually
// verified the instructor (a row in instructor_verifications) — never
// based on instructor_verification_requests.status, which the instructor
// controls themselves by resubmitting and could otherwise self-approve by
// racing a payout request against their own 'pending' state.
function canRequestPayout({ isVerified }) {
  return !!isVerified;
}

// Whether an authenticated user may start/continue Stripe Connect
// onboarding — account_type alone, not verification. Deliberately looser
// than canRequestPayout: an instructor can get Connect set up while
// waiting to be verified, since onboarding itself moves no money; the
// actual payout is what canRequestPayout gates.
function canStartConnectOnboarding({ accountType }) {
  return accountType === 'instructor';
}

module.exports = {
  LICENCE_TYPES,
  licenceTypeLabel,
  validateLicenceSubmission,
  shouldNotifySubmission,
  formatVerificationSubmittedSlackMessage,
  resolveVerificationStatus,
  canRequestPayout,
  canStartConnectOnboarding,
};
