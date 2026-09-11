'use strict';

// Supports POST/GET /api/instructor/payout-proof (see proxy.js) and the
// instructor_payout_proofs table (see the v2 migration). An instructor's
// first payout requires a photo/scan of their ADI certificate or trainee
// (PDI) licence, checked by Claude — this module holds every part of that
// check that doesn't need a live network call, so it can be unit tested
// with the Anthropic client stubbed.

const { normaliseLicenceNumber } = require('./instructorVerification');

const ALLOWED_DIRECT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isAllowedDirectMimeType(mimeType) {
  return ALLOWED_DIRECT_MIME_TYPES.includes(mimeType);
}

function isHeicMimeType(mimeType) {
  return HEIC_MIME_TYPES.includes(mimeType);
}

// Which document_type Claude should report for this instructor's declared
// licence type. Anything else — including 'other'/'unreadable', or the
// other type — fails the match and falls to pending_review.
function expectedDocumentType(licenceType) {
  return licenceType === 'adi' ? 'adi_certificate' : 'pdi_licence';
}

const DOCUMENT_CHECK_SYSTEM_PROMPT = `You are checking a photo or scan of a UK driving instructor's ADI (Approved Driving Instructor) certificate or PDI (trainee instructor, "pink licence"). Respond with ONLY a JSON object, no other text, matching exactly this shape:
{"document_type": "adi_certificate" | "pdi_licence" | "other" | "unreadable", "licence_number": string | null, "holder_name": string | null, "expiry_date": string | null, "confidence": "high" | "medium" | "low"}
- document_type: "adi_certificate" for a green ADI certificate, "pdi_licence" for a pink trainee licence, "other" for any other document, "unreadable" if you cannot make out the document at all.
- licence_number: the licence/certificate number exactly as printed, or null if not visible.
- holder_name: the name printed on the document, or null if not visible.
- expiry_date: the expiry date in ISO 8601 (YYYY-MM-DD) format if printed, otherwise null.
- confidence: your overall confidence that this is a genuine, current, in-date ADI/PDI document.
Respond with ONLY the JSON object — no markdown, no explanation.`;

// Parses Claude's raw text response into the expected shape. Tolerant of a
// ```json ... ``` fence, which models sometimes add despite being told not
// to. Anything that doesn't parse into a well-formed object — malformed
// JSON, an unrecognised document_type/confidence value — is `{ ok: false }`,
// which the caller treats exactly like a network failure: pending_review,
// check_reason 'check failed', never a silent pass or a thrown error.
function parseDocumentCheckResponse(rawText) {
  if (typeof rawText !== 'string') return { ok: false };

  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false };

  const { document_type, licence_number, holder_name, expiry_date, confidence } = parsed;
  const validTypes = ['adi_certificate', 'pdi_licence', 'other', 'unreadable'];
  const validConfidence = ['high', 'medium', 'low'];
  if (!validTypes.includes(document_type) || !validConfidence.includes(confidence)) {
    return { ok: false };
  }

  return {
    ok: true,
    extracted: {
      document_type,
      licence_number: typeof licence_number === 'string' ? licence_number : null,
      holder_name: typeof holder_name === 'string' ? holder_name : null,
      expiry_date: typeof expiry_date === 'string' ? expiry_date : null,
      confidence,
    },
  };
}

// The auto-approval rule, applied to Claude's already-parsed extraction.
// ALL must hold: document type matches the instructor's declared licence
// type; the extracted number, normalised the same way as a submission,
// equals what they originally submitted; no expiry printed or a future
// one; confidence 'high'. check_reason names whichever condition failed
// first (fixed order below) so the Slack message and instructor_payout_
// proofs.check_reason are both meaningful without re-deriving it.
function decidePayoutProofOutcome({ extracted, licenceType, licenceNumberNormalised, now = new Date() }) {
  if (extracted.document_type === 'unreadable') {
    return { autoApprove: false, checkReason: 'unreadable' };
  }
  if (extracted.document_type !== expectedDocumentType(licenceType)) {
    return { autoApprove: false, checkReason: 'document_type_mismatch' };
  }
  if (normaliseLicenceNumber(extracted.licence_number) !== licenceNumberNormalised) {
    return { autoApprove: false, checkReason: 'number_mismatch' };
  }
  if (extracted.expiry_date) {
    const expiry = new Date(extracted.expiry_date);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return { autoApprove: false, checkReason: 'expired' };
    }
  }
  if (extracted.confidence !== 'high') {
    return { autoApprove: false, checkReason: 'low_confidence' };
  }
  return { autoApprove: true, checkReason: null };
}

function formatPayoutProofAutoApprovedSlackMessage({ displayName, userId }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  return `Payout proof auto-approved: ${name}, user ${userId}`;
}

// Never the image, a signed URL, or the extracted holder name — only what a
// reviewer needs to find and act on the file.
function formatPayoutProofNeedsReviewSlackMessage({ displayName, checkReason, storagePath, userId }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  return [
    `Payout proof needs review: ${name}, reason ${checkReason}, file ${storagePath}`,
    `select admin.approve_payout_proof('${userId}');`,
    `select admin.reject_payout_proof('${userId}', 'reason');`,
  ].join('\n');
}

// Orchestrates one document check end to end: call Claude (injected via
// callAnthropic, so this is testable without a real API call), parse the
// response, apply the auto-approval rule. A thrown error/timeout from
// callAnthropic, or a response that fails to parse, is NOT rethrown — it's
// folded into the same "needs a human" outcome as a genuine mismatch, with
// check_reason 'check failed': a broken check must never silently block or
// silently approve a real payout proof, only ever land in front of a
// person.
async function checkPayoutProofDocument({ callAnthropic, licenceType, licenceNumberNormalised, now }) {
  let rawText;
  try {
    rawText = await callAnthropic();
  } catch {
    return { autoApprove: false, checkReason: 'check failed', extracted: null };
  }

  const parsed = parseDocumentCheckResponse(rawText);
  if (!parsed.ok) {
    return { autoApprove: false, checkReason: 'check failed', extracted: null };
  }

  const decision = decidePayoutProofOutcome({
    extracted: parsed.extracted,
    licenceType,
    licenceNumberNormalised,
    now,
  });
  return { ...decision, extracted: parsed.extracted };
}

module.exports = {
  ALLOWED_DIRECT_MIME_TYPES,
  HEIC_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  isAllowedDirectMimeType,
  isHeicMimeType,
  expectedDocumentType,
  DOCUMENT_CHECK_SYSTEM_PROMPT,
  parseDocumentCheckResponse,
  decidePayoutProofOutcome,
  formatPayoutProofAutoApprovedSlackMessage,
  formatPayoutProofNeedsReviewSlackMessage,
  checkPayoutProofDocument,
};
