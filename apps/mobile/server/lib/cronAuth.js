'use strict';

// Shared guard for every scheduled (cron-job.org) route. Fails CLOSED:
// if CRON_SECRET isn't configured at all, every request is refused — an
// unset secret must never mean "anyone may call this". The caller sends
// the secret in the `x-cron-secret` header.
//
// Returns true when authorised; otherwise sends 401 and returns false, so
// a route reads `if (!requireCronAuth(req, res)) return;`.
function requireCronAuth(req, res, env = process.env) {
  const secret = env.CRON_SECRET;
  const provided = req.headers ? req.headers['x-cron-secret'] : undefined;
  if (!secret || typeof provided !== 'string' || provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireCronAuth };
