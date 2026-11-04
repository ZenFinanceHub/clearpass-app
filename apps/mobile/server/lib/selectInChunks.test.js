const test = require('node:test');
const assert = require('node:assert/strict');
const { selectInChunks, PAGE_ROWS } = require('./selectInChunks');

// A stand-in for the Supabase client that behaves like PostgREST: filters by
// `.in()`, sorts by the `.order()` columns, and never returns more than
// PAGE_ROWS rows for one request, whatever `.range()` asks for. It records
// every request so the tests can check how the helper paged.
function fakeClient(rows, { error } = {}) {
  const requests = [];
  return {
    requests,
    from(table) {
      const req = { table, ids: null, order: [], range: null };
      const q = {
        select() { return q; },
        in(col, values) { req.inCol = col; req.ids = new Set(values); return q; },
        order(col) { req.order.push(col); return q; },
        range(from, to) {
          req.range = [from, to];
          requests.push(req);
          if (error) return Promise.resolve({ data: null, error });
          const matched = rows
            .filter(r => req.ids.has(r[req.inCol]))
            .sort((a, b) => {
              for (const c of req.order) {
                if (a[c] < b[c]) return -1;
                if (a[c] > b[c]) return 1;
              }
              return 0;
            });
          const end = Math.min(to + 1, from + PAGE_ROWS);
          return Promise.resolve({ data: matched.slice(from, end), error: null });
        },
      };
      return q;
    },
  };
}

const pad = n => String(n).padStart(4, '0');

function emailLogRows(learners, perLearner) {
  const rows = [];
  for (let u = 0; u < learners; u++) {
    for (let k = 0; k < perLearner; k++) rows.push({ user_id: `u${pad(u)}`, email_key: `k${pad(k)}` });
  }
  return rows;
}

const keyOf = r => `${r.user_id}/${r.email_key}`;

test('returns every row when one chunk has more than 1000 rows', async () => {
  // 150 learners x 12 emails = 1800 rows in a single chunk.
  const rows = emailLogRows(150, 12);
  const ids = [...new Set(rows.map(r => r.user_id))];
  const client = fakeClient(rows);
  const out = await selectInChunks(client, 'email_log', 'user_id, email_key, sent_at', 'user_id', ids, ['user_id', 'email_key']);
  assert.equal(out.length, 1800);
  assert.equal(new Set(out.map(keyOf)).size, 1800, 'no row returned twice');
  assert.deepEqual(client.requests.map(r => r.range), [[0, 999], [1000, 1999]]);
});

test('splits ids into chunks of 150 and pages each one', async () => {
  // 400 learners -> chunks of 150, 150, 100; 7 rows each -> 1050, 1050, 700.
  const rows = emailLogRows(400, 7);
  const ids = [...new Set(rows.map(r => r.user_id))];
  const client = fakeClient(rows);
  const out = await selectInChunks(client, 'email_log', '*', 'user_id', ids, ['user_id', 'email_key']);
  assert.equal(out.length, 2800);
  assert.equal(new Set(out.map(keyOf)).size, 2800);
  assert.deepEqual(client.requests.map(r => r.ids.size), [150, 150, 150, 150, 100]);
  assert.deepEqual(client.requests.map(r => r.range[0]), [0, 1000, 0, 1000, 0]);
});

test('a chunk of exactly 1000 rows makes one extra, empty request and stops', async () => {
  const rows = emailLogRows(100, 10);
  const ids = [...new Set(rows.map(r => r.user_id))];
  const client = fakeClient(rows);
  const out = await selectInChunks(client, 'email_log', '*', 'user_id', ids, ['user_id', 'email_key']);
  assert.equal(out.length, 1000);
  assert.equal(client.requests.length, 2);
});

test('orders by the id column unless told otherwise', async () => {
  const rows = [{ id: 'b' }, { id: 'a' }];
  const client = fakeClient(rows);
  const out = await selectInChunks(client, 'profiles', 'id', 'id', ['a', 'b']);
  assert.deepEqual(client.requests[0].order, ['id']);
  assert.deepEqual(out.map(r => r.id), ['a', 'b']);
});

test('no ids means no requests', async () => {
  const client = fakeClient([]);
  assert.deepEqual(await selectInChunks(client, 'profiles', 'id', 'id', []), []);
  assert.equal(client.requests.length, 0);
});

test('a query error is thrown, not swallowed', async () => {
  const client = fakeClient([], { error: new Error('boom') });
  await assert.rejects(selectInChunks(client, 'profiles', 'id', 'id', ['a']), /boom/);
});
