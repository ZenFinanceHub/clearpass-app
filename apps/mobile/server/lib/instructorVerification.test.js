const test = require('node:test');
const assert = require('node:assert/strict');
const {
  licenceTypeLabel,
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
} = require('./instructorVerification');

test('validateLicenceSubmission: accepts a plain ADI number', () => {
  const result = validateLicenceSubmission({ licenceType: 'adi', licenceNumber: 'AB123456' });
  assert.deepEqual(result, { ok: true, licenceNumber: 'AB123456', licenceNumberNormalised: 'AB123456' });
});

test('validateLicenceSubmission: accepts a plain trainee (pdi) number', () => {
  const result = validateLicenceSubmission({ licenceType: 'pdi', licenceNumber: '123456' });
  assert.equal(result.ok, true);
  assert.equal(result.licenceNumberNormalised, '123456');
});

test('validateLicenceSubmission: normalises spaces and hyphens, uppercases, keeps the raw value as typed', () => {
  const result = validateLicenceSubmission({ licenceType: 'adi', licenceNumber: 'ab-12 34-56' });
  assert.equal(result.ok, true);
  assert.equal(result.licenceNumber, 'ab-12 34-56');
  assert.equal(result.licenceNumberNormalised, 'AB123456');
});

test('validateLicenceSubmission: rejects too short (normalised under 4 chars)', () => {
  const result = validateLicenceSubmission({ licenceType: 'adi', licenceNumber: 'A-1' });
  assert.deepEqual(result, { ok: false, error: 'licence_number_too_short' });
});

test('validateLicenceSubmission: rejects too long (normalised over 12 chars)', () => {
  const result = validateLicenceSubmission({ licenceType: 'adi', licenceNumber: '1234567890123' });
  assert.deepEqual(result, { ok: false, error: 'licence_number_too_long' });
});

test('validateLicenceSubmission: rejects characters outside letters/digits/spaces/hyphens', () => {
  for (const bad of ['AB123456!', 'AB_123456', "AB123456'", 'AB/123456']) {
    assert.deepEqual(
      validateLicenceSubmission({ licenceType: 'adi', licenceNumber: bad }),
      { ok: false, error: 'invalid_licence_number_characters' },
      `expected ${bad} to be rejected`,
    );
  }
});

test('validateLicenceSubmission: rejects an empty or whitespace-only number', () => {
  assert.deepEqual(validateLicenceSubmission({ licenceType: 'adi', licenceNumber: '' }), { ok: false, error: 'licence_number_required' });
  assert.deepEqual(validateLicenceSubmission({ licenceType: 'adi', licenceNumber: '   ' }), { ok: false, error: 'licence_number_required' });
});

test('validateLicenceSubmission: rejects an unknown licence type', () => {
  assert.deepEqual(
    validateLicenceSubmission({ licenceType: 'instructor', licenceNumber: 'AB123456' }),
    { ok: false, error: 'invalid_licence_type' },
  );
});

test('licenceTypeLabel', () => {
  assert.equal(licenceTypeLabel('adi'), 'ADI');
  assert.equal(licenceTypeLabel('pdi'), 'Trainee');
});

test('shouldNotifySubmission: true for a brand new request', () => {
  assert.equal(shouldNotifySubmission(null, { licenceType: 'adi', licenceNumberNormalised: 'AB123456' }), true);
});

test('shouldNotifySubmission: false when type and normalised number are unchanged', () => {
  const existing = { licence_type: 'adi', licence_number_normalised: 'AB123456' };
  assert.equal(shouldNotifySubmission(existing, { licenceType: 'adi', licenceNumberNormalised: 'AB123456' }), false);
});

test('shouldNotifySubmission: true when the number changed', () => {
  const existing = { licence_type: 'adi', licence_number_normalised: 'AB123456' };
  assert.equal(shouldNotifySubmission(existing, { licenceType: 'adi', licenceNumberNormalised: 'AB999999' }), true);
});

test('shouldNotifySubmission: true when the type changed', () => {
  const existing = { licence_type: 'adi', licence_number_normalised: 'AB123456' };
  assert.equal(shouldNotifySubmission(existing, { licenceType: 'pdi', licenceNumberNormalised: 'AB123456' }), true);
});

test('hasValidDeclaration: true only for the literal boolean true', () => {
  assert.equal(hasValidDeclaration(true), true);
  assert.equal(hasValidDeclaration(false), false);
  assert.equal(hasValidDeclaration('true'), false);
  assert.equal(hasValidDeclaration(1), false);
  assert.equal(hasValidDeclaration(undefined), false);
});

test('classifyVerificationSubmission: duplicate wins regardless of this account\'s own history', () => {
  assert.equal(classifyVerificationSubmission({ hasDuplicate: true, previousStatus: undefined }), 'duplicate');
  assert.equal(classifyVerificationSubmission({ hasDuplicate: true, previousStatus: 'rejected' }), 'duplicate');
});

test('classifyVerificationSubmission: resubmission after a rejection, no duplicate', () => {
  assert.equal(classifyVerificationSubmission({ hasDuplicate: false, previousStatus: 'rejected' }), 'resubmission');
});

test('classifyVerificationSubmission: auto_verify for a fresh, non-duplicate submission', () => {
  assert.equal(classifyVerificationSubmission({ hasDuplicate: false, previousStatus: undefined }), 'auto_verify');
  assert.equal(classifyVerificationSubmission({ hasDuplicate: false, previousStatus: 'pending' }), 'auto_verify');
});

test('formatDuplicateNeedsReviewSlackMessage', () => {
  const text = formatDuplicateNeedsReviewSlackMessage({
    displayName: 'Pat Smith',
    licenceType: 'adi',
    licenceNumber: 'AB-123456',
    userId: 'u1',
    duplicate: { userId: 'u3', status: 'verified' },
  });
  assert.equal(
    text,
    [
      'Instructor needs review (duplicate number): Pat Smith, ADI AB-123456, user u1, also on u3 (verified)',
      "select admin.verify_instructor('u1');",
      "select admin.reject_instructor('u1', 'reason');",
    ].join('\n'),
  );
});

test('formatDuplicateNeedsReviewSlackMessage: falls back to "no name yet"', () => {
  const text = formatDuplicateNeedsReviewSlackMessage({
    displayName: null,
    licenceType: 'pdi',
    licenceNumber: '123456',
    userId: 'u2',
    duplicate: { userId: 'u4', status: 'pending' },
  });
  assert.ok(text.startsWith('Instructor needs review (duplicate number): no name yet, Trainee 123456, user u2, also on u4 (pending)'));
});

test('formatResubmissionNeedsReviewSlackMessage: includes the previous rejection reason', () => {
  const text = formatResubmissionNeedsReviewSlackMessage({
    displayName: 'Pat Smith',
    licenceType: 'adi',
    licenceNumber: 'AB123456',
    userId: 'u1',
    previousReviewNote: 'Number not found on register',
  });
  assert.equal(
    text,
    [
      'Instructor needs review (resubmission after rejection): Pat Smith, ADI AB123456, user u1, previous reason: Number not found on register',
      "select admin.verify_instructor('u1');",
      "select admin.reject_instructor('u1', 'reason');",
    ].join('\n'),
  );
});

test('formatResubmissionNeedsReviewSlackMessage: falls back to "none" with no previous note', () => {
  const text = formatResubmissionNeedsReviewSlackMessage({
    displayName: 'Pat Smith',
    licenceType: 'pdi',
    licenceNumber: '123456',
    userId: 'u1',
    previousReviewNote: null,
  });
  assert.ok(text.includes('previous reason: none'));
});

test('formatAutoVerifiedSlackMessage', () => {
  const text = formatAutoVerifiedSlackMessage({
    displayName: 'Pat Smith',
    licenceType: 'adi',
    licenceNumber: 'AB123456',
    userId: 'u1',
  });
  assert.equal(
    text,
    [
      'Instructor auto-verified: Pat Smith, ADI AB123456, user u1',
      "select admin.revoke_instructor('u1', 'reason');",
    ].join('\n'),
  );
});

test('autoVerifiedNote', () => {
  assert.equal(autoVerifiedNote({ licenceType: 'adi', licenceNumber: 'AB123456' }), 'auto: ADI AB123456, self-declared');
  assert.equal(autoVerifiedNote({ licenceType: 'pdi', licenceNumber: '123456' }), 'auto: Trainee 123456, self-declared');
});

test('resolveVerificationStatus: verified via instructor_verifications even with no request row (grandfathered accounts)', () => {
  const result = resolveVerificationStatus({ isVerified: true, request: null });
  assert.deepEqual(result, { status: 'verified', licenceType: null, submittedAt: null, reviewNote: null });
});

test('resolveVerificationStatus: verified, and a request row exists too', () => {
  const request = { licence_type: 'adi', submitted_at: '2026-09-11T00:00:00.000Z', status: 'verified', review_note: null };
  const result = resolveVerificationStatus({ isVerified: true, request });
  assert.deepEqual(result, { status: 'verified', licenceType: 'adi', submittedAt: '2026-09-11T00:00:00.000Z', reviewNote: null });
});

test('resolveVerificationStatus: none — no verification row, no request', () => {
  assert.deepEqual(resolveVerificationStatus({ isVerified: false, request: null }), {
    status: 'none', licenceType: null, submittedAt: null, reviewNote: null,
  });
});

test('resolveVerificationStatus: pending', () => {
  const request = { licence_type: 'pdi', submitted_at: '2026-09-11T00:00:00.000Z', status: 'pending', review_note: null };
  assert.deepEqual(resolveVerificationStatus({ isVerified: false, request }), {
    status: 'pending', licenceType: 'pdi', submittedAt: '2026-09-11T00:00:00.000Z', reviewNote: null,
  });
});

test('resolveVerificationStatus: rejected, with a review note', () => {
  const request = { licence_type: 'adi', submitted_at: '2026-09-11T00:00:00.000Z', status: 'rejected', review_note: 'Number not found' };
  assert.deepEqual(resolveVerificationStatus({ isVerified: false, request }), {
    status: 'rejected', licenceType: 'adi', submittedAt: '2026-09-11T00:00:00.000Z', reviewNote: 'Number not found',
  });
});

test('canRequestPayout: true only once BOTH verified AND proof is approved', () => {
  assert.equal(canRequestPayout({ isVerified: true, hasApprovedProof: true }), true);
  assert.equal(canRequestPayout({ isVerified: true, hasApprovedProof: false }), false);
  assert.equal(canRequestPayout({ isVerified: false, hasApprovedProof: true }), false);
  assert.equal(canRequestPayout({ isVerified: false, hasApprovedProof: false }), false);
});

test('canStartConnectOnboarding: true for account_type=instructor, false for anything else', () => {
  assert.equal(canStartConnectOnboarding({ accountType: 'instructor' }), true);
  assert.equal(canStartConnectOnboarding({ accountType: 'learner' }), false);
  assert.equal(canStartConnectOnboarding({ accountType: undefined }), false);
});
