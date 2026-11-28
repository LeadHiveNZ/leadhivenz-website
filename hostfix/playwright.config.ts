import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * BROWSER TESTS
 * These open the real site in a real (headless) browser at phone size and
 * click through it the way a person would.
 *
 * Four copies of the site run during the tests:
 *   - "plain":     nothing connected, and empty. Used for the public pages and leads.
 *   - "payments":  card payments connected to a stand-in Stripe (e2e/fake-stripe.mjs).
 *   - "demo":      the made-up sample business, for the owner, tradie and team flows.
 *   - "prelaunch": empty, with Queenstown and Wānaka on the waiting list with pre-launch on, as production is
 *                  (DECISIONS.md, 2026-11-27, second entry). Owners sign up and set up there before launch, then
 *                  the team opens the market. Also where the soak run goes (SOAK=50, e2e/prelaunch-soak.spec.ts).
 *
 * Run with:  npm run build && npm run test:e2e
 */

const PLAIN_PORT = 3210;
const PAYMENTS_PORT = 3211;
const DEMO_PORT = 3212;
const PRELAUNCH_PORT = 3213;
const FAKE_STRIPE_PORT = 3299;

export const E2E = {
  plainUrl: `http://localhost:${PLAIN_PORT}`,
  paymentsUrl: `http://localhost:${PAYMENTS_PORT}`,
  demoUrl: `http://localhost:${DEMO_PORT}`,
  prelaunchUrl: `http://localhost:${PRELAUNCH_PORT}`,
  adminPassword: "e2e-admin-password",
  webhookSecret: "whsec_e2e_secret",
};

const dataDir = (name: string) => path.join(__dirname, ".data", "e2e", name);

const sharedEnv = {
  HOSTFIX_DEMO: "1",
  ADMIN_PASSWORD: E2E.adminPassword,
  APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
  // Make sure nothing on this computer leaks into the tests.
  DATABASE_URL: "",
  CRON_SECRET: "",
  TWILIO_AUTH_TOKEN: "",
  SMS_INBOUND_SECRET: "",
  SUPABASE_URL: "",
  SUPABASE_SECRET_KEY: "",
  RESEND_API_KEY: "",
  CLICKSEND_USERNAME: "",
  CLICKSEND_API_KEY: "",
  NEXT_PUBLIC_META_PIXEL_ID: "",
  META_CAPI_ACCESS_TOKEN: "",
  // No address lookups, and no map pictures: the tests never ask LINZ or OpenStreetMap for anything.
  LINZ_DATA_KEY: "",
  LINZ_BASEMAPS_KEY: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  MAP_TILES: "off",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 7_000 },
  // The tests share one data file per site, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"], baseURL: E2E.plainUrl },
    },
  ],
  webServer: [
    {
      command: `node e2e/fake-stripe.mjs`,
      url: `http://localhost:${FAKE_STRIPE_PORT}/health`,
      reuseExistingServer: false,
      env: { FAKE_STRIPE_PORT: String(FAKE_STRIPE_PORT) },
    },
    {
      command: `npx next start -p ${PLAIN_PORT}`,
      url: `${E2E.plainUrl}/robots.txt`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        APP_URL: E2E.plainUrl,
        HOSTFIX_DATA_DIR: dataDir("plain"),
        HOSTFIX_SAMPLE_DATA: "0",
        STRIPE_NZ_SECRET_KEY: "",
        STRIPE_NZ_WEBHOOK_SECRET: "",
      },
    },
    {
      command: `npx next start -p ${PAYMENTS_PORT}`,
      url: `${E2E.paymentsUrl}/robots.txt`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        APP_URL: E2E.paymentsUrl,
        HOSTFIX_DATA_DIR: dataDir("payments"),
        HOSTFIX_SAMPLE_DATA: "0",
        STRIPE_NZ_SECRET_KEY: "sk_test_e2e_fake_key",
        STRIPE_NZ_WEBHOOK_SECRET: E2E.webhookSecret,
        STRIPE_TEST_SERVER: `http://localhost:${FAKE_STRIPE_PORT}`,
      },
    },
    {
      command: `npx next start -p ${DEMO_PORT}`,
      url: `${E2E.demoUrl}/robots.txt`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        APP_URL: E2E.demoUrl,
        HOSTFIX_DATA_DIR: dataDir("demo"),
        STRIPE_NZ_SECRET_KEY: "",
        STRIPE_NZ_WEBHOOK_SECRET: "",
      },
    },
    {
      command: `npx next start -p ${PRELAUNCH_PORT}`,
      url: `${E2E.prelaunchUrl}/robots.txt`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        APP_URL: E2E.prelaunchUrl,
        HOSTFIX_DATA_DIR: dataDir("prelaunch"),
        HOSTFIX_SAMPLE_DATA: "0",
        STRIPE_NZ_SECRET_KEY: "",
        STRIPE_NZ_WEBHOOK_SECRET: "",
      },
    },
  ],
});
