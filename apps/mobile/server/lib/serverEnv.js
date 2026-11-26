'use strict';

// Which environment this server is: local, staging or production. Pure.
//
// CLEARPASS_SERVER_ENV: local | staging | production. Unset or empty means
// production, so the Railway service (which doesn't set it today) behaves
// exactly as before. `local` is what scripts/local-stack.js sets (see #108 /
// docs/environments.md). Any other value throws rather than guessing.

const SERVER_ENVS = Object.freeze(['local', 'staging', 'production']);

function resolveServerEnv(env) {
  const raw = typeof env.CLEARPASS_SERVER_ENV === 'string' ? env.CLEARPASS_SERVER_ENV.trim() : '';
  if (raw === '') return 'production';
  if (!SERVER_ENVS.includes(raw)) {
    throw new Error(`CLEARPASS_SERVER_ENV must be local, staging or production (got ${JSON.stringify(raw)})`);
  }
  return raw;
}

module.exports = { SERVER_ENVS, resolveServerEnv };
