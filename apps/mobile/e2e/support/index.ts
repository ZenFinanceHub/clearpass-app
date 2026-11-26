// Import `test` and `expect` from here in every spec, never from
// '@playwright/test' directly — this `test` installs the network harness.
import { test as base, expect } from '@playwright/test';
import { NetworkHarness, formatUnexpected } from './harness';

export { expect };
export type { NetworkHarness, NetworkStub, RecordedRequest } from './harness';
export { json } from './stubs';
export { PRODUCTION_HOSTS, SUPABASE_HOST, RAILWAY_HOST } from './hosts';
export { clientNavigate } from './navigation';
export { seedLearner, seedLocalStorage, signInAs, syntheticProgress, STORAGE_KEYS } from './learner';

/** The deployed origin, only when explicitly opted in (see playwright.config.ts). */
const REMOTE_ORIGIN = process.env.E2E_REMOTE_BASE_URL
  ? new URL(process.env.E2E_REMOTE_BASE_URL).origin
  : null;

export const test = base.extend<{ network: NetworkHarness }>({
  network: [
    async ({ context }, use) => {
      const harness = new NetworkHarness(REMOTE_ORIGIN ? [REMOTE_ORIGIN] : []);
      await harness.install(context);
      await use(harness);
      // Catch requests fired just after the last assertion (e.g. on-mount fetches).
      await harness.settle();
      const unexpected = harness.unexpected;
      if (unexpected.length > 0) {
        throw new Error(
          `e2e network guard: ${unexpected.length} request(s) to un-stubbed external hosts ` +
            `were blocked. Stub them (see e2e/README.md) or remove the call:\n${formatUnexpected(unexpected)}`,
        );
      }
    },
    { auto: true },
  ],

  // APIRequestContext bypasses page routing, so it could reach a real host.
  // Specs must drive the app through the page instead.
  request: async ({}, use) => {
    void use;
    throw new Error('e2e network guard: the `request` fixture is disabled (it bypasses the stub harness).');
  },
});
