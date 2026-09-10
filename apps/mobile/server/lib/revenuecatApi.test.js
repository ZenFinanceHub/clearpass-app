const test = require('node:test');
const assert = require('node:assert/strict');
const { getProEntitlement, PRO_ENTITLEMENT_ID } = require('./revenuecatApi');

// Temporarily replaces both the REVENUECAT_SECRET_API_KEY env var and the
// global fetch, restoring both afterward — global.fetch is a shared
// resource, so every test using it must clean up regardless of pass/fail.
async function withMocks(apiKey, fetchImpl, fn) {
  const previousKey = process.env.REVENUECAT_SECRET_API_KEY;
  const previousFetch = global.fetch;
  if (apiKey === undefined) {
    delete process.env.REVENUECAT_SECRET_API_KEY;
  } else {
    process.env.REVENUECAT_SECRET_API_KEY = apiKey;
  }
  global.fetch = fetchImpl;
  try {
    await fn();
  } finally {
    if (previousKey === undefined) {
      delete process.env.REVENUECAT_SECRET_API_KEY;
    } else {
      process.env.REVENUECAT_SECRET_API_KEY = previousKey;
    }
    global.fetch = previousFetch;
  }
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

test('getProEntitlement: throws immediately if REVENUECAT_SECRET_API_KEY is not set, never calls fetch', async () => {
  await withMocks(undefined, async () => {
    throw new Error('fetch should not have been called');
  }, async () => {
    await assert.rejects(() => getProEntitlement('a1b2c3d4-e5f6-4789-a012-3456789abcde'));
  });
});

test('getProEntitlement: calls the correct URL with a Bearer header carrying the key', async () => {
  let capturedUrl;
  let capturedHeaders;
  await withMocks('sk_test_123', async (url, opts) => {
    capturedUrl = url;
    capturedHeaders = opts.headers;
    return jsonResponse(200, { items: [], next_page: null });
  }, async () => {
    await getProEntitlement('a1b2c3d4-e5f6-4789-a012-3456789abcde');
  });

  assert.equal(
    capturedUrl,
    'https://api.revenuecat.com/v2/projects/proj76530af5/customers/a1b2c3d4-e5f6-4789-a012-3456789abcde/active_entitlements',
  );
  assert.equal(capturedHeaders.Authorization, 'Bearer sk_test_123');
});

test('getProEntitlement: matches on entitlement_id and converts epoch-ms expires_at to ISO', async () => {
  await withMocks('sk_test', async () => jsonResponse(200, {
    items: [
      { object: 'customer.active_entitlement', entitlement_id: 'entl_other', expires_at: 9999999999999 },
      { object: 'customer.active_entitlement', entitlement_id: PRO_ENTITLEMENT_ID, expires_at: 1900000000000 },
    ],
    next_page: null,
  }), async () => {
    const result = await getProEntitlement('user1');
    assert.equal(result.active, true);
    assert.equal(result.expiresAt, new Date(1900000000000).toISOString());
  });
});

test('getProEntitlement: a different entitlement_id only (not "pro") resolves to not active', async () => {
  await withMocks('sk_test', async () => jsonResponse(200, {
    items: [{ object: 'customer.active_entitlement', entitlement_id: 'entl_other', expires_at: 9999999999999 }],
    next_page: null,
  }), async () => {
    const result = await getProEntitlement('user1');
    assert.deepEqual(result, { active: false, expiresAt: null });
  });
});

test('getProEntitlement: a null expires_at (non-expiring) resolves active with expiresAt null', async () => {
  await withMocks('sk_test', async () => jsonResponse(200, {
    items: [{ object: 'customer.active_entitlement', entitlement_id: PRO_ENTITLEMENT_ID, expires_at: null }],
    next_page: null,
  }), async () => {
    const result = await getProEntitlement('user1');
    assert.deepEqual(result, { active: true, expiresAt: null });
  });
});

test('getProEntitlement: an expires_at that is neither a number nor null throws', async () => {
  await withMocks('sk_test', async () => jsonResponse(200, {
    items: [{ object: 'customer.active_entitlement', entitlement_id: PRO_ENTITLEMENT_ID, expires_at: '2027-01-01T00:00:00.000Z' }],
    next_page: null,
  }), async () => {
    await assert.rejects(() => getProEntitlement('user1'), /unexpected expires_at/);
  });
});

test('getProEntitlement: empty items list resolves to not active', async () => {
  await withMocks('sk_test', async () => jsonResponse(200, { items: [], next_page: null }), async () => {
    const result = await getProEntitlement('user1');
    assert.deepEqual(result, { active: false, expiresAt: null });
  });
});

test('getProEntitlement: follows next_page across multiple pages until a match is found', async () => {
  const calls = [];
  await withMocks('sk_test', async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return jsonResponse(200, {
        items: [{ object: 'customer.active_entitlement', entitlement_id: 'entl_other', expires_at: 1000 }],
        next_page: 'https://api.revenuecat.com/v2/projects/proj76530af5/customers/user1/active_entitlements?page=2',
      });
    }
    return jsonResponse(200, {
      items: [{ object: 'customer.active_entitlement', entitlement_id: PRO_ENTITLEMENT_ID, expires_at: 2000 }],
      next_page: null,
    });
  }, async () => {
    const result = await getProEntitlement('user1');
    assert.equal(calls.length, 2);
    assert.equal(result.active, true);
    assert.equal(result.expiresAt, new Date(2000).toISOString());
  });
});

test('getProEntitlement: follows next_page to the end with no match anywhere — not active', async () => {
  const calls = [];
  await withMocks('sk_test', async () => {
    calls.push(1);
    if (calls.length === 1) {
      return jsonResponse(200, {
        items: [{ object: 'customer.active_entitlement', entitlement_id: 'entl_other', expires_at: 1000 }],
        next_page: 'https://api.revenuecat.com/v2/projects/proj76530af5/customers/user1/active_entitlements?page=2',
      });
    }
    return jsonResponse(200, { items: [], next_page: null });
  }, async () => {
    const result = await getProEntitlement('user1');
    assert.equal(calls.length, 2);
    assert.deepEqual(result, { active: false, expiresAt: null });
  });
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`getProEntitlement: a ${status} response throws (fails closed)`, async () => {
    await withMocks('sk_test', async () => jsonResponse(status, {}), async () => {
      await assert.rejects(() => getProEntitlement('user1'), new RegExp(String(status)));
    });
  });
}

test('getProEntitlement: a response body without an items array throws', async () => {
  await withMocks('sk_test', async () => jsonResponse(200, { not_items: [] }), async () => {
    await assert.rejects(() => getProEntitlement('user1'), /items array/);
  });
});

test('getProEntitlement: a network error throws', async () => {
  await withMocks('sk_test', async () => { throw new Error('ECONNRESET'); }, async () => {
    await assert.rejects(() => getProEntitlement('user1'), /ECONNRESET/);
  });
});
