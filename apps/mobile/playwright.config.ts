import { defineConfig, devices } from '@playwright/test';

// Default target: a local static web export (dist-e2e/) served on loopback.
// All Supabase / Railway traffic is answered by synthetic stubs and anything
// else external is blocked — see e2e/README.md and e2e/support/.
//
// E2E_REMOTE_BASE_URL is an explicit, local-only opt-in to load the pages
// from a deployed origin instead (public pages only: no sign-in, and the
// network harness still stubs/blocks every backend call). It is refused in CI.
const PORT = Number(process.env.E2E_PORT ?? 8090);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const REMOTE_URL = process.env.E2E_REMOTE_BASE_URL;

if (process.env.BASE_URL) {
  throw new Error('BASE_URL is no longer read. The suite runs against a local export; see e2e/README.md.');
}
if (REMOTE_URL && process.env.CI) {
  throw new Error('E2E_REMOTE_BASE_URL is not allowed in CI. The CI suite only runs against the local export.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list'], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: REMOTE_URL ?? LOCAL_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // A service worker's fetches would bypass page routing.
    serviceWorkers: 'block',
  },

  webServer: REMOTE_URL
    ? undefined
    : {
        // E2E_SKIP_EXPORT=1 reuses an existing dist-e2e/ (faster local reruns).
        command: process.env.E2E_SKIP_EXPORT
          ? `node e2e/support/static-server.mjs dist-e2e ${PORT}`
          : `npx expo export --platform web --output-dir dist-e2e --clear && node e2e/support/static-server.mjs dist-e2e ${PORT}`,
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 10 * 60 * 1000,
        stdout: 'pipe',
        env: {
          // Never bake a developer's local .env into the test bundle.
          EXPO_NO_DOTENV: '1',
          EXPO_NO_TELEMETRY: '1',
        },
      },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
