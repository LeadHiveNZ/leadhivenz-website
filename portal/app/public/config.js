// LeadHive Partner Portal — public configuration.
// These values are safe to ship to the browser (the anon key only works through row level security).
// Fill in supabaseUrl + supabaseAnonKey from Supabase → Project Settings → API.
window.LEADHIVE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  portalUrl: "https://portal.leadhivenz.com",
  // logo: "/logo.png", logoSmall: "/logo-small.png",   // override if you swap the artwork
  adminEmail: "hello@leadhivenz.com",
  joe: {
    name: "Joe",
    phone: "+64 21 000 0000",          // shown as the "Call" button on the Account screen
    whatsapp: "https://wa.me/64210000000",
    email: "hello@leadhivenz.com",
  },
};
