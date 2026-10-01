// The Tipsy Tui — AI intake
// POST { text?: string, file_base64?: string, file_type?: string }
// Reads a pasted contract / quote / email thread (or an uploaded PDF or photo)
// and returns a draft booking the app shows for review before saving.
//
// Deploy:  supabase functions deploy intake
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are the booking assistant for The Tipsy Tui, a mobile caravan bar in Christchurch, New Zealand, run by Joe and Kieran.

Your job: read whatever Joe sends (a signed hire agreement, a quote PDF, an email thread, a text message, a photo of a contract) and extract one booking as structured data for the team's job scheduler. Extract only what is in the material. For text fields, use an empty string "" when the material does not say. For number fields, use null when unknown. Never invent a date, a price or a guest count.

How The Tipsy Tui works (use this to classify, not to invent):
- Three packages. "dry_hire" (also called Classic Tui): caravan delivered, set up and packed down, client supplies and serves their own drinks, no bartenders, $300 refundable bond. "byo" (also called The Tui Experience or BYO Bar Package): client supplies the alcohol, Tipsy Tui supplies bartenders and runs the bar. "fully_catered" (also called The Premium Tui or Fully Catered Bar): Tipsy Tui supplies and serves all drinks.
- A quote or agreement names the package in its heading or schedule. Agreements that say "the Hirer is solely responsible for supplying all beverages and bar staff" are dry_hire.
- Bartenders: 1 per 50 guests unless the document states a number.
- Travel: the base is Christchurch. Estimate one-way drive minutes only if the venue is clearly outside Christchurch metro (for example Hanmer Springs is about 110, Akaroa about 85, Tekapo about 190, Ashburton about 60, Rolleston or West Melton about 25, Lyttelton 0). Set 0 for Christchurch city.
- Deposit is normally 25% of the total unless the document states otherwise. Bond applies to dry hire only, normally $300.
- Dates are New Zealand format (day first). Times are 24-hour "HH:MM".

Also write:
- "flags": a short list of things Joe needs to confirm or chase (missing times, no deposit mentioned, venue TBC, liquor licence, access, power, accommodation for far-away jobs). Keep each flag one plain sentence.
- "summary": one or two casual sentences in the team's voice, like a text to Kieran. Kiwi, direct, no corporate tone.`;

// Text fields use "" (empty) for unknown. Only the six numeric fields may be null. The API allows at most 16 nullable fields.
const BOOKING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    client_name: { type: "string", description: "Person or business booking, e.g. 'Sarah & Jake' or 'Tuatara Structures'" },
    contact_name: { type: "string", description: "First name of the person to email/text" },
    email: { type: "string" },
    phone: { type: "string" },
    event_name: { type: "string", description: "e.g. 'Golden Oldies Rugby Reunion', 'Sarah & Jake's wedding'" },
    event_type: { type: "string", enum: ["wedding", "birthday", "corporate", "reunion", "festival", "other"], description: "Use 'other' when unsure" },
    event_date: { type: "string", description: "ISO date YYYY-MM-DD" },
    start_time: { type: "string", description: "Bar service start, HH:MM 24h" },
    finish_time: { type: "string", description: "Bar service finish, HH:MM 24h" },
    venue: { type: "string" },
    address: { type: "string" },
    travel_minutes: { type: ["integer", "null"], description: "One-way drive minutes from Christchurch, 0 for local" },
    guest_count: { type: ["integer", "null"] },
    package: { type: "string", enum: ["dry_hire", "byo", "fully_catered"] },
    bartender_count: { type: ["integer", "null"], description: "Only if the document states it" },
    glassware: { type: "boolean", description: "Tipsy Tui supplying glassware" },
    generator: { type: "boolean" },
    fairy_lights: { type: "boolean" },
    cocktails: { type: "boolean", description: "Cocktail service or cocktail station included" },
    accommodation: { type: "boolean", description: "Staff accommodation included" },
    kegs_on_tap: { type: "string", description: "What is going on the taps, if mentioned" },
    drinks_notes: { type: "string", description: "Drinks allowance, drinks list, or what the client is bringing" },
    total: { type: ["number", "null"], description: "Total price in NZD incl. GST" },
    deposit_amount: { type: ["number", "null"] },
    deposit_paid: { type: "boolean" },
    bond_amount: { type: ["number", "null"] },
    status: { type: "string", enum: ["enquiry", "quoted", "confirmed"], description: "confirmed if it is a signed agreement or Joe says it is booked/locked in; quoted if it is only a quote; enquiry otherwise" },
    notes: { type: "string", description: "Anything else the team needs on the day: access, power, licence, special requests" },
    flags: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: [
    "client_name", "contact_name", "email", "phone", "event_name", "event_type", "event_date",
    "start_time", "finish_time", "venue", "address", "travel_minutes", "guest_count", "package",
    "bartender_count", "glassware", "generator", "fairy_lights", "cocktails", "accommodation",
    "kegs_on_tap", "drinks_notes", "total", "deposit_amount", "deposit_paid", "bond_amount",
    "status", "notes", "flags", "summary",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // Everything is inside one try so the app always gets a readable answer, even when something unexpected breaks.
  try {
    return await handle(req);
  } catch (err) {
    console.error("intake crashed:", err);
    return json({ error: "Function crashed: " + (err instanceof Error ? err.message : String(err)) }, 500);
  }
});

function findApiKey(): string | undefined {
  // Accept a few secret names so a typo in the dashboard doesn't block bookings.
  const env = Deno.env.toObject();
  for (const name of ["ANTHROPIC_API_KEY", "CLAUDE_KEY", "CLAUDE_API_KEY", "Claude Key", "Claude_Key", "CLAUDE"]) {
    if (env[name]) return env[name];
  }
  const loose = Object.keys(env).find((k) => /claude|anthropic/i.test(k) && env[k]?.startsWith("sk-ant-"));
  return loose ? env[loose] : undefined;
}

async function handle(req: Request): Promise<Response> {
  // Only logged-in team members can use this.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Not logged in (" + (authError?.message ?? "no user") + ")" }, 401);

  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").trim();
  const fileBase64: string | undefined = body.file_base64;
  const fileType: string | undefined = body.file_type;
  if (!text && !fileBase64) return json({ error: "Send some text or a file" }, 400);

  const content: Anthropic.ContentBlockParam[] = [];
  if (fileBase64 && fileType === "application/pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } });
  } else if (fileBase64 && fileType?.startsWith("image/")) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: fileType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: fileBase64 },
    });
  }
  content.push({
    type: "text",
    text: `Today's date is ${new Date().toISOString().slice(0, 10)}.\n\nExtract the booking from the material below. Use the extract_booking schema.\n\n<material>\n${text || "(see attached file)"}\n</material>`,
  });

  const apiKey = findApiKey();
  if (!apiKey) return json({ error: "No Claude key found. Add a secret named ANTHROPIC_API_KEY under Edge Functions → Secrets." }, 500);
  // An organisation-level key needs the workspace named on every request; a workspace key does not.
  const workspaceId = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
  const client = new Anthropic({ apiKey, defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: BOOKING_SCHEMA } },
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "The assistant declined to read this material. Try pasting the text instead." }, 422);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return json({ error: "No booking found in that material" }, 422);

    const booking = JSON.parse(textBlock.text);
    for (const k of Object.keys(booking)) if (booking[k] === "") booking[k] = null;
    return json({ booking, source_text: text || `(uploaded ${fileType})` });
  } catch (err) {
    console.error("intake failed:", err);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The Claude key is wrong or revoked" }, 500);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Rate limited, try again in a minute" }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: `Claude API error ${err.status}: ${err.message}` }, 502);
    return json({ error: String(err) }, 500);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
