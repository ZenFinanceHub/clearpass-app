const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedDirectMimeType,
  isHeicMimeType,
  expectedDocumentType,
  parseDocumentCheckResponse,
  decidePayoutProofOutcome,
  formatPayoutProofAutoApprovedSlackMessage,
  formatPayoutProofNeedsReviewSlackMessage,
  checkPayoutProofDocument,
} = require('./payoutProof');

test('isAllowedDirectMimeType / isHeicMimeType', () => {
  assert.equal(isAllowedDirectMimeType('image/jpeg'), true);
  assert.equal(isAllowedDirectMimeType('image/png'), true);
  assert.equal(isAllowedDirectMimeType('image/webp'), true);
  assert.equal(isAllowedDirectMimeType('application/pdf'), true);
  assert.equal(isAllowedDirectMimeType('image/heic'), false);
  assert.equal(isAllowedDirectMimeType('application/msword'), false);
  assert.equal(isHeicMimeType('image/heic'), true);
  assert.equal(isHeicMimeType('image/heif'), true);
  assert.equal(isHeicMimeType('image/jpeg'), false);
});

test('expectedDocumentType', () => {
  assert.equal(expectedDocumentType('adi'), 'adi_certificate');
  assert.equal(expectedDocumentType('pdi'), 'pdi_licence');
});

test('parseDocumentCheckResponse: parses a plain JSON object', () => {
  const result = parseDocumentCheckResponse(
    '{"document_type":"adi_certificate","licence_number":"AB123456","holder_name":"Pat Smith","expiry_date":"2030-01-01","confidence":"high"}'
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.extracted, {
    document_type: 'adi_certificate',
    licence_number: 'AB123456',
    holder_name: 'Pat Smith',
    expiry_date: '2030-01-01',
    confidence: 'high',
  });
});

test('parseDocumentCheckResponse: strips a ```json fence', () => {
  const result = parseDocumentCheckResponse(
    '```json\n{"document_type":"pdi_licence","licence_number":null,"holder_name":null,"expiry_date":null,"confidence":"medium"}\n```'
  );
  assert.equal(result.ok, true);
  assert.equal(result.extracted.document_type, 'pdi_licence');
});

test('parseDocumentCheckResponse: rejects malformed JSON', () => {
  assert.equal(parseDocumentCheckResponse('not json at all').ok, false);
  assert.equal(parseDocumentCheckResponse('').ok, false);
  assert.equal(parseDocumentCheckResponse(undefined).ok, false);
});

test('parseDocumentCheckResponse: rejects an unrecognised document_type or confidence value', () => {
  assert.equal(
    parseDocumentCheckResponse('{"document_type":"passport","licence_number":null,"holder_name":null,"expiry_date":null,"confidence":"high"}').ok,
    false
  );
  assert.equal(
    parseDocumentCheckResponse('{"document_type":"adi_certificate","licence_number":null,"holder_name":null,"expiry_date":null,"confidence":"certain"}').ok,
    false
  );
});

const BASE_EXTRACTED = {
  document_type: 'adi_certificate',
  licence_number: 'AB123456',
  holder_name: 'Pat Smith',
  expiry_date: null,
  confidence: 'high',
};

test('decidePayoutProofOutcome: auto-approves when every condition holds', () => {
  const result = decidePayoutProofOutcome({
    extracted: BASE_EXTRACTED,
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.deepEqual(result, { autoApprove: true, checkReason: null });
});

test('decidePayoutProofOutcome: normalises the extracted number the same way as a submission before comparing', () => {
  const result = decidePayoutProofOutcome({
    extracted: { ...BASE_EXTRACTED, licence_number: 'ab-12 34-56' },
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.deepEqual(result, { autoApprove: true, checkReason: null });
});

test('decidePayoutProofOutcome: unreadable', () => {
  const result = decidePayoutProofOutcome({
    extracted: { ...BASE_EXTRACTED, document_type: 'unreadable' },
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.deepEqual(result, { autoApprove: false, checkReason: 'unreadable' });
});

test('decidePayoutProofOutcome: document type mismatch (wrong type, and "other")', () => {
  assert.deepEqual(
    decidePayoutProofOutcome({ extracted: { ...BASE_EXTRACTED, document_type: 'pdi_licence' }, licenceType: 'adi', licenceNumberNormalised: 'AB123456' }),
    { autoApprove: false, checkReason: 'document_type_mismatch' }
  );
  assert.deepEqual(
    decidePayoutProofOutcome({ extracted: { ...BASE_EXTRACTED, document_type: 'other' }, licenceType: 'adi', licenceNumberNormalised: 'AB123456' }),
    { autoApprove: false, checkReason: 'document_type_mismatch' }
  );
});

test('decidePayoutProofOutcome: number mismatch', () => {
  const result = decidePayoutProofOutcome({
    extracted: { ...BASE_EXTRACTED, licence_number: 'ZZ999999' },
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.deepEqual(result, { autoApprove: false, checkReason: 'number_mismatch' });
});

test('decidePayoutProofOutcome: expired', () => {
  const result = decidePayoutProofOutcome({
    extracted: { ...BASE_EXTRACTED, expiry_date: '2020-01-01' },
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
    now: new Date('2026-09-11T00:00:00.000Z'),
  });
  assert.deepEqual(result, { autoApprove: false, checkReason: 'expired' });
});

test('decidePayoutProofOutcome: a future expiry date is fine', () => {
  const result = decidePayoutProofOutcome({
    extracted: { ...BASE_EXTRACTED, expiry_date: '2099-01-01' },
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
    now: new Date('2026-09-11T00:00:00.000Z'),
  });
  assert.deepEqual(result, { autoApprove: true, checkReason: null });
});

test('decidePayoutProofOutcome: low/medium confidence needs review even when everything else matches', () => {
  assert.deepEqual(
    decidePayoutProofOutcome({ extracted: { ...BASE_EXTRACTED, confidence: 'medium' }, licenceType: 'adi', licenceNumberNormalised: 'AB123456' }),
    { autoApprove: false, checkReason: 'low_confidence' }
  );
  assert.deepEqual(
    decidePayoutProofOutcome({ extracted: { ...BASE_EXTRACTED, confidence: 'low' }, licenceType: 'adi', licenceNumberNormalised: 'AB123456' }),
    { autoApprove: false, checkReason: 'low_confidence' }
  );
});

test('formatPayoutProofAutoApprovedSlackMessage', () => {
  assert.equal(formatPayoutProofAutoApprovedSlackMessage({ displayName: 'Pat Smith', userId: 'u1' }), 'Payout proof auto-approved: Pat Smith, user u1');
  assert.equal(formatPayoutProofAutoApprovedSlackMessage({ displayName: null, userId: 'u2' }), 'Payout proof auto-approved: no name yet, user u2');
});

test('formatPayoutProofNeedsReviewSlackMessage: includes reason, storage path, and the approve/reject lines — never the image or a name from the document', () => {
  const text = formatPayoutProofNeedsReviewSlackMessage({
    displayName: 'Pat Smith',
    checkReason: 'number_mismatch',
    storagePath: 'u1/1234567890.jpg',
    userId: 'u1',
  });
  assert.equal(
    text,
    [
      'Payout proof needs review: Pat Smith, reason number_mismatch, file u1/1234567890.jpg',
      "select admin.approve_payout_proof('u1');",
      "select admin.reject_payout_proof('u1', 'reason');",
    ].join('\n')
  );
});

test('checkPayoutProofDocument: auto-approves on a clean response', async () => {
  const result = await checkPayoutProofDocument({
    callAnthropic: async () => JSON.stringify(BASE_EXTRACTED),
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.equal(result.autoApprove, true);
  assert.equal(result.checkReason, null);
  assert.deepEqual(result.extracted, BASE_EXTRACTED);
});

test('checkPayoutProofDocument: an Anthropic call that throws (error/timeout) becomes "check failed", never thrown', async () => {
  const result = await checkPayoutProofDocument({
    callAnthropic: async () => { throw new Error('timeout'); },
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.deepEqual(result, { autoApprove: false, checkReason: 'check failed', extracted: null });
});

test('checkPayoutProofDocument: an unparseable response becomes "check failed"', async () => {
  const result = await checkPayoutProofDocument({
    callAnthropic: async () => 'I cannot help with that.',
    licenceType: 'adi',
    licenceNumberNormalised: 'AB123456',
  });
  assert.deepEqual(result, { autoApprove: false, checkReason: 'check failed', extracted: null });
});
