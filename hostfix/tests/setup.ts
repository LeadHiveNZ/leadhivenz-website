/**
 * Runs before every test file.
 *
 * The tests also run as part of each deploy, on a machine where your real
 * keys are present. A test that expects "nothing is connected" must see
 * exactly that, so every setting the app reads is removed here first. Each
 * test then switches on only what it needs.
 */

const APP_SETTINGS = [
  "APP_URL",
  "APP_SECRET",
  "ADMIN_PASSWORD",
  "HOSTFIX_DEMO",
  "HOSTFIX_DATA_DIR",
  "PORT",
  "DATABASE_URL",
  "DATABASE_CA_CERT",
  "DATABASE_POOL_MAX",
  "CRON_SECRET",
  "SMS_INBOUND_SECRET",
  "HOSTFIX_SAMPLE_DATA",
  "SUPABASE_BUCKET",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALERT_EMAIL_TO",
  "ALERT_SMS_TO",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SMS_PROVIDER",
  "SMS_FROM",
  "CLICKSEND_USERNAME",
  "CLICKSEND_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
  "STRIPE_TEST_SERVER",
  "NEXT_PUBLIC_META_PIXEL_ID",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "META_CAPI_ACCESS_TOKEN",
  "META_GRAPH_VERSION",
  "META_TEST_EVENT_CODE",
];

for (const name of Object.keys(process.env)) {
  if (APP_SETTINGS.includes(name) || name.startsWith("STRIPE_") || name === "VERCEL" || name.startsWith("VERCEL_")) {
    delete process.env[name];
  }
}
