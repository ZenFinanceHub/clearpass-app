// Network harness for every e2e spec.
//
// Rules (see e2e/README.md):
//   * loopback (the local web export)          -> passes through
//   * the opted-in remote origin, if any       -> passes through (local runs only)
//   * Supabase REST/auth/storage/functions     -> synthetic stub (never forwarded)
//   * Railway API                              -> synthetic stub (never forwarded)
//   * anything else                            -> aborted
// Every non-loopback request is recorded. A request that no stub claimed makes
// the test FAIL at teardown, even if the app swallowed the network error.
import type { BrowserContext, Request, Route, WebSocketRoute } from '@playwright/test';
import { isLoopback } from './hosts';
import { defaultStubs } from './stubs';

export interface RecordedRequest {
  method: string;
  url: string;
  host: string;
  /** Name of the stub that answered it, or null if it was blocked. */
  stub: string | null;
  kind: 'http' | 'websocket';
}

export interface StubContext {
  harness: NetworkHarness;
  url: URL;
  request: Request;
}

export interface NetworkStub {
  name: string;
  match: (url: URL, request: Request) => boolean;
  handle: (route: Route, ctx: StubContext) => Promise<void>;
}

export interface FakeUser {
  id: string;
  email: string;
  [key: string]: unknown;
}

export type Row = Record<string, unknown>;

export class NetworkHarness {
  readonly requests: RecordedRequest[] = [];
  /** Synthetic Supabase tables served by the default REST stub (GET returns rows). */
  readonly db: Record<string, Row[]> = {};
  /** Synthetic Supabase RPC results, keyed by function name. Default: null. */
  readonly rpc: Record<string, unknown> = {};
  /** The user /auth/v1/user returns. null = signed out (401). */
  authUser: FakeUser | null = null;
  /** Text the fake Ask Pip (/api/explain) replies with. */
  pipReply = 'This is a synthetic Ask Pip reply from the e2e harness.';

  private readonly customStubs: NetworkStub[] = [];
  private readonly disabledDefaults = new Set<string>();
  private readonly passThroughOrigins: Set<string>;

  constructor(passThroughOrigins: string[] = []) {
    this.passThroughOrigins = new Set(passThroughOrigins);
  }

  /** Requests no stub claimed (blocked). The test fails if this is non-empty. */
  get unexpected(): RecordedRequest[] {
    return this.requests.filter((r) => r.stub === null);
  }

  /** Register a stub that takes priority over the defaults (last added wins). */
  stub(stub: NetworkStub): void {
    this.customStubs.unshift(stub);
  }

  /** Turn off a default stub by name ('supabase' | 'railway'), so its traffic is blocked. */
  disableDefaultStub(name: string): void {
    this.disabledDefaults.add(name);
  }

  /** Requests to a given host, for assertions. */
  requestsTo(host: string): RecordedRequest[] {
    return this.requests.filter((r) => r.host === host || r.host.endsWith(`.${host}`));
  }

  /**
   * Forget requests that were blocked on purpose (guard spec only). Returns
   * what was removed so the caller can assert on it.
   */
  acknowledgeUnexpected(): RecordedRequest[] {
    const removed = this.unexpected;
    for (const r of removed) this.requests.splice(this.requests.indexOf(r), 1);
    return removed;
  }

  /** Wait until no new external request has been seen for `quietMs` (capped at `maxMs`). */
  async settle(quietMs = 300, maxMs = 2000): Promise<void> {
    const deadline = Date.now() + maxMs;
    let seen = this.requests.length;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, quietMs));
      if (this.requests.length === seen) return;
      seen = this.requests.length;
    }
  }

  private stubFor(url: URL, request: Request): NetworkStub | undefined {
    const all = [
      ...this.customStubs,
      ...defaultStubs.filter((s) => !this.disabledDefaults.has(s.name)),
    ];
    return all.find((s) => s.match(url, request));
  }

  private passesThrough(url: URL): boolean {
    return isLoopback(url.hostname) || this.passThroughOrigins.has(url.origin);
  }

  async install(context: BrowserContext): Promise<void> {
    await context.route('**/*', (route, request) => this.onRoute(route, request));
    await context.routeWebSocket(/.*/, (ws) => this.onWebSocket(ws));
  }

  private async onRoute(route: Route, request: Request): Promise<void> {
    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      await safe(() => route.abort('blockedbyclient'));
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      await safe(() => route.continue());
      return;
    }
    if (this.passesThrough(url)) {
      await safe(() => route.continue());
      return;
    }

    const stub = this.stubFor(url, request);
    this.requests.push({
      method: request.method(),
      url: request.url(),
      host: url.hostname,
      stub: stub?.name ?? null,
      kind: 'http',
    });
    if (!stub) {
      await safe(() => route.abort('blockedbyclient'));
      return;
    }
    try {
      await stub.handle(route, { harness: this, url, request });
    } catch (err) {
      // A broken stub must never fall through to the real network.
      await safe(() => route.abort('failed'));
      throw err;
    }
  }

  private onWebSocket(ws: WebSocketRoute): void {
    const url = new URL(ws.url());
    if (this.passesThrough(url)) {
      ws.connectToServer();
      return;
    }
    // Supabase Realtime: keep the socket mocked (open, silent) — never connected.
    const isSupabase =
      url.hostname.endsWith('.supabase.co') && !this.disabledDefaults.has('supabase');
    this.requests.push({
      method: 'WS',
      url: ws.url(),
      host: url.hostname,
      stub: isSupabase ? 'supabase-realtime' : null,
      kind: 'websocket',
    });
    if (!isSupabase) void ws.close({ code: 1008, reason: 'blocked by e2e harness' });
  }
}

async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Page/context already closed — nothing left to protect.
  }
}

export function formatUnexpected(list: RecordedRequest[]): string {
  return list.map((r) => `  ${r.method} ${r.url}`).join('\n');
}
