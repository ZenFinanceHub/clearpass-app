const test = require('node:test');
const assert = require('node:assert/strict');
const {
  licenceTypeLabel,
  validateLicenceSubmission,
  shouldNotifySubmission,
  formatVerificationSubmittedSlackMessage,
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

test('formatVerificationSubmittedSlackMessage: full message with the paste-in admin lines', () => {
  const text = formatVerificationSubmittedSlackMessage({
    displayName: 'Pat Smith',
    licenceType: 'adi',
    licenceNumber: 'AB-123456',
    userId: 'u1',
  });
  assert.equal(
    text,
    [
      'Instructor to verify: Pat Smith, ADI AB-123456, user u1',
      "select admin.verify_instructor('u1');",
      "select admin.reject_instructor('u1', 'reason');",
    ].join('\n'),
  );
});

test('formatVerificationSubmittedSlackMessage: falls back to "no name yet"', () => {
  const text = formatVerificationSubmittedSlackMessage({
    displayName: null,
    licenceType: 'pdi',
    licenceNumber: '123456',
    userId: 'u2',
  });
  assert.ok(text.startsWith('Instructor to verify: no name yet, Trainee 123456, user u2'));
});

test('formatVerificationSubmittedSlackMessage: appends a duplicate-number warning line', () => {
  const text = formatVerificationSubmittedSlackMessage({
    displayName: 'Pat Smith',
    licenceType: 'adi',
    licenceNumber: 'AB123456',
    userId: 'u1',
    duplicate: { userId: 'u3', status: 'verified' },
  });
  assert.ok(text.endsWith('Warning: same licence number already on file for user u3 (status: verified)'));
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

test('canRequestPayout: true only once verified', () => {
  assert.equal(canRequestPayout({ isVerified: true }), true);
  assert.equal(canRequestPayout({ isVerified: false }), false);
});

test('canStartConnectOnboarding: true for account_type=instructor, false for anything else', () => {
  assert.equal(canStartConnectOnboarding({ accountType: 'instructor' }), true);
  assert.equal(canStartConnectOnboarding({ accountType: 'learner' }), false);
  assert.equal(canStartConnectOnboarding({ accountType: undefined }), false);
});
