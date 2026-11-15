import "server-only";

/**
 * Reads settings from environment variables. Secrets never live in code.
 * See .env.example for the full list and SETUP.md for where each comes from.
 */

/** Returns the trimmed value, or undefined if it is missing or blank. */
export function env(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isVercel(): boolean {
  return Boolean(env("VERCEL"));
}

/**
 * Demo mode keeps leads in a file on this computer and only pretends to send
 * alerts. It exists so the site can be tried before any accounts are set up.
 * It can never switch on once the site is hosted on Vercel.
 */
export function demoModeAllowed(): boolean {
  if (isVercel()) return false;
  if (env("HOSTFIX_DEMO") === "1") return true;
  return !isProduction();
}

/**
 * The public address of the site, with no trailing slash. Used for links in
 * alert emails and for sending people back from the card payment page.
 * On Vercel this is worked out automatically.
 */
export function baseUrl(): string {
  const explicit = env("APP_URL")?.replace(/\/+$/, "");
  const vercelEnv = env("VERCEL_ENV");

  if (explicit && (!isVercel() || vercelEnv === "production")) return explicit;

  if (vercelEnv === "production") {
    const production = env("VERCEL_PROJECT_PRODUCTION_URL");
    if (production) return `https://${production}`;
  }
  const deployment = env("VERCEL_BRANCH_URL") ?? env("VERCEL_URL");
  if (deployment) return `https://${deployment}`;

  if (explicit) return explicit;
  return `http://localhost:${env("PORT") ?? "3000"}`;
}

const DEV_ONLY_SECRET = "hostfix-dev-only-secret-not-for-production-use";

/**
 * The key used to sign cookies and links. Must be at least 32 characters.
 * Outside production a fixed development value is used so the site runs with
 * no setup. In production a missing secret means signing is unavailable.
 */
export function appSecret(): string | null {
  const secret = env("APP_SECRET");
  if (secret && secret.length >= 32) return secret;
  if (demoModeAllowed()) return DEV_ONLY_SECRET;
  return null;
}

export function appSecretProblem(): string | null {
  const secret = env("APP_SECRET");
  if (!secret) return "APP_SECRET is not set.";
  if (secret.length < 32) return "APP_SECRET is too short. It needs at least 32 characters.";
  return null;
}
