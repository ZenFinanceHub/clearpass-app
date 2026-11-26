'use strict';

// Environment configuration for lib/revenuecatApi.js: production pins its
// RevenueCat project/entitlement ids, staging/local must set their own.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getProEntitlement,
  resolveRevenueCatConfig,
  assertRevenueCatConfigAtStartup,
  PRO_ENTITLEMENT_ID,
  PRODUCTION_REVENUECAT_PROJECT_ID,
  PRODUCTION_PRO_ENTITLEMENT_ID,
} = require('./revenuecatApi');

const STAGING_IDS = { REVENUECAT_PROJECT_ID: 'projstaging01', REVENUECAT_PRO_ENTITLEMENT_ID: 'entlstaging01' };
const MANAGED_VARS = ['CLEARPASS_SERVER_ENV', 'REVENUECAT_PROJECT_ID', 'REVENUECAT_PRO_ENTITLEMENT_ID', 'REVENUECAT_SECRET_API_KEY'];

// Sets exactly these env vars (the other managed ones unset) and a fake
// global fetch for fn, restoring everything afterwards.
async function withEnvAndFetch(vars, fetchImpl, fn) {
  const saved = Object.fromEntries(MANAGED_VARS.map((k) => [k, process.env[k]]));
  const previousFetch = global.fetch;
  for (const k of MANAGED_VARS) {
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  global.fetch = fetchImpl;
  try {
    await fn();
  } finally {
    for (const k of MANAGED_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    global.fetch = previousFetch;
  }
}

const noFetch = async () => { throw new Error('fetch should not have been called'); };
const jsonResponse = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('production (unset or explicit) pins the existing ids', () => {
  assert.equal(PRODUCTION_REVENUECAT_PROJECT_ID, 'proj76530af5');
  assert.equal(PRODUCTION_PRO_ENTITLEMENT_ID, 'entlafbd9083d9');
  assert.equal(PRO_ENTITLEMENT_ID, PRODUCTION_PRO_ENTITLEMENT_ID);
  for (const env of [{}, { CLEARPASS_SERVER_ENV: '' }, { CLEARPASS_SERVER_ENV: 'production' }]) {
    assert.deepEqual(resolveRevenueCatConfig(env), {
      serverEnv: 'production', projectId: 'proj76530af5', proEntitlementId: 'entlafbd9083d9',
    });
    assert.ok(assertRevenueCatConfigAtStartup(env));
  }
  // Explicitly setting the same values is harmless.
  assert.equal(resolveRevenueCatConfig({
    REVENUECAT_PROJECT_ID: 'proj76530af5', REVENUECAT_PRO_ENTITLEMENT_ID: 'entlafbd9083d9',
  }).projectId, 'proj76530af5');
});

test('production with a conflicting override refuses, at startup too', () => {
  assert.throws(() => resolveRevenueCatConfig({ REVENUECAT_PROJECT_ID: 'projother' }), /REVENUECAT_PROJECT_ID differs/);
  assert.throws(
    () => resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: 'production', REVENUECAT_PRO_ENTITLEMENT_ID: 'entlother' }),
    /REVENUECAT_PRO_ENTITLEMENT_ID differs/,
  );
  assert.throws(() => assertRevenueCatConfigAtStartup({ ...STAGING_IDS }), /differs/);
});

test('staging with missing ids fails, naming what is missing', () => {
  assert.throws(
    () => resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: 'staging' }),
    /requires REVENUECAT_PROJECT_ID and REVENUECAT_PRO_ENTITLEMENT_ID/,
  );
  assert.throws(
    () => resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: 'staging', REVENUECAT_PROJECT_ID: 'projstaging01' }),
    /requires REVENUECAT_PRO_ENTITLEMENT_ID/,
  );
  assert.throws(() => assertRevenueCatConfigAtStartup({ CLEARPASS_SERVER_ENV: 'staging' }), /requires/);
});

test('staging or local with a production id fails', () => {
  for (const serverEnv of ['staging', 'local']) {
    assert.throws(
      () => resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: serverEnv, ...STAGING_IDS, REVENUECAT_PROJECT_ID: 'proj76530af5' }),
      /production RevenueCat id/,
    );
    assert.throws(
      () => resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: serverEnv, ...STAGING_IDS, REVENUECAT_PRO_ENTITLEMENT_ID: 'entlafbd9083d9' }),
      /production RevenueCat id/,
    );
    assert.throws(
      () => assertRevenueCatConfigAtStartup({
        CLEARPASS_SERVER_ENV: serverEnv, REVENUECAT_PROJECT_ID: 'proj76530af5', REVENUECAT_PRO_ENTITLEMENT_ID: 'entlafbd9083d9',
      }),
      /production RevenueCat id/,
    );
  }
});

test('staging with its own ids resolves to them', () => {
  assert.deepEqual(resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: 'staging', ...STAGING_IDS }), {
    serverEnv: 'staging', projectId: 'projstaging01', proEntitlementId: 'entlstaging01',
  });
  assert.ok(assertRevenueCatConfigAtStartup({ CLEARPASS_SERVER_ENV: 'staging', ...STAGING_IDS }));
});

test('unknown CLEARPASS_SERVER_ENV throws', () => {
  assert.throws(() => resolveRevenueCatConfig({ CLEARPASS_SERVER_ENV: 'prod' }), /CLEARPASS_SERVER_ENV must be/);
  assert.throws(() => assertRevenueCatConfigAtStartup({ CLEARPASS_SERVER_ENV: 'prod' }), /CLEARPASS_SERVER_ENV must be/);
});

test('local with no RevenueCat ids at all starts (with a warning) but API calls fail closed', async () => {
  assert.equal(assertRevenueCatConfigAtStartup({ CLEARPASS_SERVER_ENV: 'local' }), null);
  // Half-configured is a mistake, not "not using RevenueCat".
  assert.throws(
    () => assertRevenueCatConfigAtStartup({ CLEARPASS_SERVER_ENV: 'local', REVENUECAT_PROJECT_ID: 'projlocal' }),
    /requires REVENUECAT_PRO_ENTITLEMENT_ID/,
  );
  await withEnvAndFetch({ CLEARPASS_SERVER_ENV: 'local', REVENUECAT_SECRET_API_KEY: 'sk_test' }, noFetch, async () => {
    await assert.rejects(() => getProEntitlement('user1'), /requires REVENUECAT_PROJECT_ID/);
  });
});

test('getProEntitlement: production URL and entitlement are unchanged', async () => {
  let capturedUrl;
  await withEnvAndFetch({ REVENUECAT_SECRET_API_KEY: 'sk_test' }, async (url) => {
    capturedUrl = url;
    return jsonResponse(200, {
      items: [{ object: 'customer.active_entitlement', entitlement_id: 'entlafbd9083d9', expires_at: 1900000000000 }],
      next_page: null,
    });
  }, async () => {
    assert.equal((await getProEntitlement('user1')).active, true);
  });
  assert.equal(capturedUrl, 'https://api.revenuecat.com/v2/projects/proj76530af5/customers/user1/active_entitlements');
});

test('getProEntitlement: staging uses its own project id in the URL and its own entitlement id', async () => {
  let capturedUrl;
  await withEnvAndFetch({ CLEARPASS_SERVER_ENV: 'staging', ...STAGING_IDS, REVENUECAT_SECRET_API_KEY: 'sk_test' }, async (url) => {
    capturedUrl = url;
    return jsonResponse(200, {
      items: [
        // The production id means nothing in the staging project.
        { object: 'customer.active_entitlement', entitlement_id: 'entlafbd9083d9', expires_at: 9999999999999 },
        { object: 'customer.active_entitlement', entitlement_id: 'entlstaging01', expires_at: 1900000000000 },
      ],
      next_page: null,
    });
  }, async () => {
    assert.deepEqual(await getProEntitlement('user1'), { active: true, expiresAt: new Date(1900000000000).toISOString() });
  });
  assert.equal(capturedUrl, 'https://api.revenuecat.com/v2/projects/projstaging01/customers/user1/active_entitlements');
});

test('getProEntitlement: staging with only the production entitlement active is not active', async () => {
  await withEnvAndFetch({ CLEARPASS_SERVER_ENV: 'staging', ...STAGING_IDS, REVENUECAT_SECRET_API_KEY: 'sk_test' }, async () => jsonResponse(200, {
    items: [{ object: 'customer.active_entitlement', entitlement_id: 'entlafbd9083d9', expires_at: 9999999999999 }],
    next_page: null,
  }), async () => {
    assert.deepEqual(await getProEntitlement('user1'), { active: false, expiresAt: null });
  });
});

test('getProEntitlement: misconfigured production or staging throws before any request', async () => {
  await withEnvAndFetch({ REVENUECAT_PROJECT_ID: 'projother', REVENUECAT_SECRET_API_KEY: 'sk_test' }, noFetch, async () => {
    await assert.rejects(() => getProEntitlement('user1'), /differs/);
  });
  await withEnvAndFetch({ CLEARPASS_SERVER_ENV: 'staging', REVENUECAT_SECRET_API_KEY: 'sk_test' }, noFetch, async () => {
    await assert.rejects(() => getProEntitlement('user1'), /requires/);
  });
});
