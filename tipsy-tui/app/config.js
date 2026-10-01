// The Tipsy Tui — app config
// Paste your Supabase project values here (Supabase → Project Settings → API).
// Leave both blank and the app runs in Demo mode with sample jobs stored only on this device.
window.TIPSY_CONFIG = {
  SUPABASE_URL: "https://uyertymsgxxiwcnhovlm.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_NLHiSoxqXc1dzKgbz8ooSw_td-L3Tft",
  // Names shown on the checklist "who" toggle. Order matters: first is the default.
  TEAM: ["Joe", "Kieran"],
  // Home base for travel calculations.
  BASE: "Christchurch",
  // Upload a contract and it books straight in (no review screen) when it can read the client and the date.
  AUTO_BOOK: true,
  // Who gets which tasks by default. "admin" = client, money and paperwork. "ops" = caravan, stock, gear.
  // Day-of tasks stay unassigned (you're both there).
  ASSIGN: { admin: "Joe", ops: "Kieran" },
  // Name of the Supabase edge function that reads contracts (as shown in its URL). Case matters.
  INTAKE_FUNCTION: "Intake",
};
