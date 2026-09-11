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

// Shared with lib/payoutProof.js, which normalises Claude's extracted
// licence_number the exact same way to compare it against what the
// instructor originally submitted.
function normaliseLicenceNumber(raw) {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/[ -]/g, '') : '';
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
  const licenceNumberNormalised = normaliseLicenceNumber(trimmed);
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

// v2: POST /api/instructor/verification requires an explicit declaration —
// separate from validateLicenceSubmission, which only judges the licence
// fields themselves.
function hasValidDeclaration(declaration) {
  return declaration === true;
}

// Which of the three submission outcomes applies, given what's already on
// file. Checked in this order deliberately: a duplicate always needs a
// human regardless of this account's own history (two different people
// can't both hold the same licence number), so it wins over "this account
// was previously rejected" even if both are somehow true at once.
function classifyVerificationSubmission({ hasDuplicate, previousStatus }) {
  if (hasDuplicate) return 'duplicate';
  if (previousStatus === 'rejected') return 'resubmission';
  return 'auto_verify';
}

function formatDuplicateNeedsReviewSlackMessage({ displayName, licenceType, licenceNumber, userId, duplicate }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  return [
    `Instructor needs review (duplicate number): ${name}, ${licenceTypeLabel(licenceType)} ${licenceNumber}, user ${userId}, also on ${duplicate.userId} (${duplicate.status})`,
    `select admin.verify_instructor('${userId}');`,
    `select admin.reject_instructor('${userId}', 'reason');`,
  ].join('\n');
}

function formatResubmissionNeedsReviewSlackMessage({ displayName, licenceType, licenceNumber, userId, previousReviewNote }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  const previousReason = previousReviewNote && previousReviewNote.trim() ? previousReviewNote.trim() : 'none';
  return [
    `Instructor needs review (resubmission after rejection): ${name}, ${licenceTypeLabel(licenceType)} ${licenceNumber}, user ${userId}, previous reason: ${previousReason}`,
    `select admin.verify_instructor('${userId}');`,
    `select admin.reject_instructor('${userId}', 'reason');`,
  ].join('\n');
}

function formatAutoVerifiedSlackMessage({ displayName, licenceType, licenceNumber, userId }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  return [
    `Instructor auto-verified: ${name}, ${licenceTypeLabel(licenceType)} ${licenceNumber}, user ${userId}`,
    `select admin.revoke_instructor('${userId}', 'reason');`,
  ].join('\n');
}

// The instructor_verifications.note for an auto-verified request — 'auto:'
// prefix distinguishes it at a glance from a manually-verified one's note
// (see admin.verify_instructor's own note format in the v1 migration).
function autoVerifiedNote({ licenceType, licenceNumber }) {
  return `auto: ${licenceTypeLabel(licenceType)} ${licenceNumber}, self-declared`;
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

// Whether a payout can be requested: verified (a row in
// instructor_verifications — never instructor_verification_requests.status,
// which the instructor controls themselves by resubmitting) AND an
// approved payout-proof document. Both are required — verification alone
// no longer unlocks payouts as of v2; a self-declared licence number
// (possibly auto-verified) still needs a real document checked before
// money moves.
function canRequestPayout({ isVerified, hasApprovedProof }) {
  return !!isVerified && !!hasApprovedProof;
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
  normaliseLicenceNumber,
  validateLicenceSubmission,
  hasValidDeclaration,
  classifyVerificationSubmission,
  shouldNotifySubmission,
  formatDuplicateNeedsReviewSlackMessage,
  formatResubmissionNeedsReviewSlackMessage,
  formatAutoVerifiedSlackMessage,
  autoVerifiedNote,
  resolveVerificationStatus,
  canRequestPayout,
  canStartConnectOnboarding,
};
