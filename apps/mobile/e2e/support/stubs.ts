// Default synthetic backends. Nothing here ever forwards a request: every
// handler ends in route.fulfill(). Add new defaults sparingly; per-test
// overrides go through `network.stub(...)` (see e2e/README.md).
import type { Route } from '@playwright/test';
import type { NetworkStub, StubContext } from './harness';
import { RAILWAY_HOST } from './hosts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'Access-Control-Expose-Headers': 'Content-Range, X-Supabase-Api-Version',
};

export async function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  await route.fulfill({
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

async function preflight(route: Route) {
  await route.fulfill({ status: 204, headers: CORS, body: '' });
}

// 1x1 transparent PNG, served for any storage object that looks like an image.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const SVG_1PX = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

// ── Supabase ─────────────────────────────────────────────────────────────────

async function supabaseAuth(route: Route, { harness, url, request }: StubContext, path: string) {
  const method = request.method();
  if (path === 'user') {
    if (method === 'GET') {
      return harness.authUser
        ? json(route, 200, harness.authUser)
        : json(route, 401, { code: 401, error_code: 'no_authorization', msg: 'No synthetic session' });
    }
    return json(route, 200, harness.authUser ?? {});
  }
  if (path === 'token') {
    // No real auth exists in e2e: password/PKCE/refresh grants all fail.
    const grant = url.searchParams.get('grant_type') ?? 'unknown';
    return json(route, 400, {
      code: 400,
      error_code: 'invalid_grant',
      msg: `Synthetic auth: ${grant} grant rejected by e2e harness`,
    });
  }
  if (path === 'logout') return route.fulfill({ status: 204, headers: CORS, body: '' });
  if (path === 'settings') {
    return json(route, 200, { external: { email: true, google: true, apple: true }, disable_signup: false });
  }
  // otp, recover, signup, resend, verify, factors ...: accept and do nothing.
  return json(route, 200, {});
}

async function supabaseRest(route: Route, { harness, request }: StubContext, path: string) {
  const method = request.method();
  const accept = request.headers()['accept'] ?? '';
  const wantsObject = accept.includes('application/vnd.pgrst.object+json');

  if (path.startsWith('rpc/')) {
    const fn = path.slice('rpc/'.length);
    return json(route, 200, fn in harness.rpc ? harness.rpc[fn] : null);
  }

  const table = path.split('/')[0];
  const rows = harness.db[table] ?? [];

  if (method === 'HEAD') {
    return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Range': `*/${rows.length}` }, body: '' });
  }
  if (method === 'GET') {
    const range = rows.length ? `0-${rows.length - 1}/${rows.length}` : `*/0`;
    if (wantsObject) {
      if (rows.length === 1) return json(route, 200, rows[0], { 'Content-Range': range });
      return json(route, 406, {
        code: 'PGRST116',
        details: `The result contains ${rows.length} rows`,
        hint: null,
        message: 'JSON object requested, multiple (or no) rows returned',
      });
    }
    return json(route, 200, rows, { 'Content-Range': range });
  }
  // POST / PATCH / PUT / DELETE: pretend it worked, echo the payload.
  let payload: unknown = null;
  try {
    payload = request.postDataJSON();
  } catch {
    payload = null;
  }
  const echoed = Array.isArray(payload) ? payload : payload ? [payload] : [];
  if (wantsObject) return json(route, 201, echoed[0] ?? {});
  return json(route, method === 'DELETE' ? 200 : 201, echoed);
}

async function supabaseStorage(route: Route, _ctx: StubContext, path: string) {
  const lower = path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)(\?|$)/.test(lower)) {
    return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/png' }, body: PNG_1PX });
  }
  if (/\.svg(\?|$)/.test(lower)) {
    return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/svg+xml' }, body: SVG_1PX });
  }
  if (lower.startsWith('object/list')) return json(route, 200, []);
  return json(route, 404, { statusCode: '404', error: 'not_found', message: 'Synthetic storage: object not found' });
}

const supabaseStub: NetworkStub = {
  name: 'supabase',
  match: (url) => url.hostname.endsWith('.supabase.co'),
  handle: async (route, ctx) => {
    if (ctx.request.method() === 'OPTIONS') return preflight(route);
    const p = ctx.url.pathname;
    const after = (prefix: string) => p.slice(prefix.length);
    if (p.startsWith('/auth/v1/')) return supabaseAuth(route, ctx, after('/auth/v1/'));
    if (p.startsWith('/rest/v1/')) return supabaseRest(route, ctx, after('/rest/v1/'));
    if (p.startsWith('/storage/v1/')) return supabaseStorage(route, ctx, after('/storage/v1/'));
    if (p.startsWith('/functions/v1/')) return json(route, 200, {});
    return json(route, 404, { message: 'Synthetic Supabase: unknown path' });
  },
};

// ── Railway API (apps/mobile/server) ─────────────────────────────────────────

const railwayStub: NetworkStub = {
  name: 'railway',
  match: (url) => url.hostname === RAILWAY_HOST,
  handle: async (route, { harness, url, request }) => {
    if (request.method() === 'OPTIONS') return preflight(route);
    switch (url.pathname) {
      case '/api/explain':
        // Ask Pip and the AI study plan. Shape mirrors the Anthropic Messages API.
        return json(route, 200, { content: [{ type: 'text', text: harness.pipReply }] });
      case '/api/config':
        return json(route, 200, { stripeTestMode: true, webMonthlyAvailable: true });
      case '/api/create-checkout-session':
        // Never hand the app a real Stripe URL.
        return json(route, 503, { error: 'Checkout disabled in e2e' });
      default:
        return json(route, 200, { ok: true });
    }
  },
};

export const defaultStubs: NetworkStub[] = [supabaseStub, railwayStub];
