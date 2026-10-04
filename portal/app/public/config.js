// LeadHive Partner Portal — public configuration.
// These values are safe to ship to the browser (the anon key only works through row level security).
// Project: leadhive-portal (fysavxlknutiqtmnhjua). The service_role key lives only in Netlify env vars.
window.LEADHIVE_CONFIG = {
  supabaseUrl: "https://fysavxlknutiqtmnhjua.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5c2F2eGxrbnV0aXF0bW5oanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNjA0NDQsImV4cCI6MjEwNjYzNjQ0NH0.FUuh-AuUQ3J6Xh6DzX3ZXiSjiQPzu7VrBKzACOgrFU0",
  portalUrl: "",   // empty = use whatever address the portal is open on (e.g. the Netlify address)
  // logo: "/logo.png", logoSmall: "/logo-small.png",   // override if you swap the artwork
  adminEmail: "hello@leadhivenz.com",
  joe: {
    name: "Joe",
    phone: "+61 450 925 145",          // shown as the "Call" button on the Account screen
    whatsapp: "https://wa.me/61450925145",
    email: "hello@leadhivenz.com",
  },
};
