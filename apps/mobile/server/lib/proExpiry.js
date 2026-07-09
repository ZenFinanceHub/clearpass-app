'use strict';

const PRO_DURATION_MONTHS = 3;

function computeProExpiresAt(fromDate = new Date()) {
  const d = new Date(fromDate);
  const expires = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + PRO_DURATION_MONTHS,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  ));
  return expires.toISOString();
}

module.exports = { computeProExpiresAt, PRO_DURATION_MONTHS };
