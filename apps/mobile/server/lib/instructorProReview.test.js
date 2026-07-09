const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getQuarterAnchor,
  getQuarterNumberForDate,
  getQuarterBounds,
  getMonthIndexInQuarter,
  isLastDayOfMonth,
  isWarningDay,
  daysUntilMonthEnd,
  resolveQualification,
  getMonthStatus,
  buildQuarter1UpdateEmailHtml,
  buildMonthEndEmailHtml,
  buildWarningEmailHtml,
} = require('./instructorProReview');

test('getQuarterAnchor floors to the 1st of the activation month, UTC', () => {
  const anchor = getQuarterAnchor('2026-03-15T10:00:00Z');
  assert.equal(anchor.toISOString().slice(0, 10), '2026-03-01');
});

test('getQuarterNumberForDate returns 1 for dates in the anchor quarter', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-03-20T00:00:00Z')), 1);
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-05-31T00:00:00Z')), 1);
});

test('getQuarterNumberForDate rolls to quarter 2 after 3 calendar months', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-06-01T00:00:00Z')), 2);
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-08-31T00:00:00Z')), 2);
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-09-01T00:00:00Z')), 3);
});

test('getQuarterBounds returns 3 whole calendar months for quarter 1', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  const { quarterStart, quarterEnd, months } = getQuarterBounds(anchor, 1);
  assert.equal(quarterStart.toISOString().slice(0, 10), '2026-03-01');
  assert.equal(quarterEnd.toISOString().slice(0, 10), '2026-05-31');
  assert.equal(months.length, 3);
  assert.equal(months[0].start.toISOString().slice(0, 10), '2026-03-01');
  assert.equal(months[0].end.toISOString().slice(0, 10), '2026-04-01');
  assert.equal(months[2].start.toISOString().slice(0, 10), '2026-05-01');
  assert.equal(months[2].end.toISOString().slice(0, 10), '2026-06-01');
});

test('getQuarterBounds returns quarter 2 immediately after quarter 1', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  const q2 = getQuarterBounds(anchor, 2);
  assert.equal(q2.quarterStart.toISOString().slice(0, 10), '2026-06-01');
  assert.equal(q2.quarterEnd.toISOString().slice(0, 10), '2026-08-31');
});

test('getMonthIndexInQuarter identifies which of the 3 months a date falls in', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-03-20T00:00:00Z')), 0);
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-04-20T00:00:00Z')), 1);
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-05-20T00:00:00Z')), 2);
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-06-20T00:00:00Z')), 0);
});

test('isLastDayOfMonth', () => {
  assert.equal(isLastDayOfMonth(new Date('2026-02-28T00:00:00Z')), true);
  assert.equal(isLastDayOfMonth(new Date('2026-04-30T00:00:00Z')), true);
  assert.equal(isLastDayOfMonth(new Date('2026-04-29T00:00:00Z')), false);
  assert.equal(isLastDayOfMonth(new Date('2028-02-29T00:00:00Z')), true);
});

test('isWarningDay only true on the 20th', () => {
  assert.equal(isWarningDay(new Date('2026-07-20T00:00:00Z')), true);
  assert.equal(isWarningDay(new Date('2026-07-19T00:00:00Z')), false);
});

test('daysUntilMonthEnd', () => {
  assert.equal(daysUntilMonthEnd(new Date('2026-07-20T00:00:00Z')), 11);
  assert.equal(daysUntilMonthEnd(new Date('2026-07-31T00:00:00Z')), 0);
});

test('resolveQualification: 10+ standing qualifies regardless of monthly pace', () => {
  const result = resolveQualification({ monthConversions: [0, 0, 0], peakActiveCount: 10 });
  assert.deepEqual(result, { qualifies: true, qualifyReason: 'ten_plus_standing' });
});

test('resolveQualification: 2+ conversions every month qualifies', () => {
  const result = resolveQualification({ monthConversions: [2, 3, 2], peakActiveCount: 4 });
  assert.deepEqual(result, { qualifies: true, qualifyReason: 'monthly_pace' });
});

test('resolveQualification: missing the pace in any single month fails', () => {
  const result = resolveQualification({ monthConversions: [2, 1, 2], peakActiveCount: 4 });
  assert.deepEqual(result, { qualifies: false, qualifyReason: 'failed' });
});

test('getMonthStatus reflects month/standing status independent of resolution', () => {
  assert.equal(getMonthStatus({ monthConversions: 0, peakActiveCount: 10 }), 'qualifies_via_standing');
  assert.equal(getMonthStatus({ monthConversions: 2, peakActiveCount: 3 }), 'on_track');
  assert.equal(getMonthStatus({ monthConversions: 1, peakActiveCount: 3 }), 'at_risk');
});

test('quarter 1 emails never use risk/warning/lapse framing', () => {
  const html = buildQuarter1UpdateEmailHtml({ instructorName: 'Sam', conversions: 0, activeCount: 0 });
  const lower = html.toLowerCase();
  for (const word of ['at risk', 'warning', 'lapse', 'lapsed']) {
    assert.equal(lower.includes(word), false, `quarter-1 email should not contain "${word}"`);
  }
  assert.match(html, /continues automatically/i);
});

test('quarter 2+ warning email states days remaining and conversions needed', () => {
  const html = buildWarningEmailHtml({
    instructorName: 'Sam', conversions: 1, activeCount: 2, daysRemaining: 8, conversionsNeeded: 1,
  });
  assert.match(html, /8/);
  assert.match(html, /1 more/i);
});

test('month-end email reflects at_risk status for quarter 2+', () => {
  const html = buildMonthEndEmailHtml({
    instructorName: 'Sam', conversions: 0, activeCount: 0, status: 'at_risk', quarterResolved: false, qualifies: null,
  });
  assert.match(html, /at risk/i);
});
