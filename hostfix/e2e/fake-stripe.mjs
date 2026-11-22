// A stand-in for Stripe, used only by the automated browser tests.
// It understands just enough of Stripe's API for the deposit journey:
//   POST /v1/checkout/sessions        create a card page
//   GET  /v1/checkout/sessions/:id    look one up
//   GET  /pay/:id                     the pretend card page (Pay or Cancel)
//   GET  /pay/:id/confirm             "the card went through"
// and, like Stripe, for a hold on a saved card (DECISIONS.md, 2026-11-23):
//   POST /v1/payment_intents               a charge, or with capture_method=manual a hold ("requires_capture",
//                                          its charge saying capture_before). A payment method ending in
//                                          "declines" is declined, as a card error.
//   POST /v1/payment_intents/:id/capture   takes up to the held amount (amount_to_capture), never more
//   POST /v1/payment_intents/:id/cancel    lets an uncaptured hold go; nothing is charged
//   GET  /v1/payment_intents/:id           look one up
// No real money, no real network.

import { randomBytes } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.FAKE_STRIPE_PORT ?? 3299);
const sessions = new Map();
const intents = new Map();
// The shortest hold a card network gives (Visa, merchant-initiated): 4 days 18 hours.
const HOLD_SECONDS = (4 * 24 + 18) * 3600;

function intentJson(intent) {
  return {
    id: intent.id,
    object: "payment_intent",
    amount: intent.amount,
    amount_capturable: intent.status === "requires_capture" ? intent.amount : 0,
    amount_received: intent.received,
    currency: intent.currency,
    capture_method: intent.manual ? "manual" : "automatic",
    status: intent.status,
    metadata: intent.metadata,
    latest_charge: {
      id: intent.chargeId,
      object: "charge",
      payment_method_details: { type: "card", card: intent.manual ? { capture_before: intent.captureBefore } : {} },
    },
    livemode: false,
  };
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Request-Id": `req_${randomBytes(6).toString("hex")}` });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function sessionJson(session) {
  return {
    id: session.id,
    object: "checkout.session",
    mode: "payment",
    status: session.paid ? "complete" : "open",
    payment_status: session.paid ? "paid" : "unpaid",
    amount_total: session.amount,
    currency: session.currency,
    client_reference_id: session.leadId,
    customer: session.paid ? `cus_fake_${session.suffix}` : null,
    customer_email: session.email,
    payment_intent: session.paid ? `pi_fake_${session.suffix}` : null,
    metadata: session.metadata,
    success_url: session.successUrl,
    cancel_url: session.cancelUrl,
    url: session.paid ? null : `http://localhost:${PORT}/pay/${session.id}`,
    livemode: false,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });

  if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
    const form = new URLSearchParams(await readBody(req));
    const suffix = randomBytes(12).toString("hex");
    const metadata = {};
    for (const [key, value] of form) {
      const match = /^metadata\[(.+)\]$/.exec(key);
      if (match) metadata[match[1]] = value;
    }
    const session = {
      id: `cs_test_${suffix}`,
      suffix,
      paid: false,
      amount: Number(form.get("line_items[0][price_data][unit_amount]")),
      currency: form.get("line_items[0][price_data][currency]"),
      leadId: form.get("client_reference_id"),
      email: form.get("customer_email"),
      successUrl: form.get("success_url"),
      cancelUrl: form.get("cancel_url"),
      allowedMethods: form.getAll("allowed_payment_method_types[0]"),
      metadata,
    };
    sessions.set(session.id, session);
    return json(res, 200, sessionJson(session));
  }

  if (req.method === "POST" && url.pathname === "/v1/payment_intents") {
    const form = new URLSearchParams(await readBody(req));
    const suffix = randomBytes(12).toString("hex");
    const metadata = {};
    for (const [key, value] of form) {
      const match = /^metadata\[(.+)\]$/.exec(key);
      if (match) metadata[match[1]] = value;
    }
    const manual = form.get("capture_method") === "manual";
    const intent = {
      id: `pi_fake_${suffix}`, chargeId: `ch_fake_${suffix}`, amount: Number(form.get("amount")), currency: form.get("currency"), manual, metadata,
      status: manual ? "requires_capture" : "succeeded", received: manual ? 0 : Number(form.get("amount")),
      captureBefore: Math.floor(Date.now() / 1000) + HOLD_SECONDS,
    };
    if ((form.get("payment_method") ?? "").endsWith("declines")) {
      intent.status = "requires_payment_method";
      intents.set(intent.id, intent);
      return json(res, 402, { error: { type: "card_error", code: "card_declined", decline_code: "generic_decline", message: "Your card was declined.", payment_intent: intentJson(intent) } });
    }
    intents.set(intent.id, intent);
    return json(res, 200, intentJson(intent));
  }

  const intentAction = /^\/v1\/payment_intents\/([A-Za-z0-9_]+)(?:\/(capture|cancel))?$/.exec(url.pathname);
  if (intentAction) {
    const intent = intents.get(intentAction[1]);
    if (!intent) return json(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such payment_intent" } });
    if (req.method === "GET" && !intentAction[2]) return json(res, 200, intentJson(intent));
    const form = new URLSearchParams(await readBody(req));
    if (intentAction[2] === "capture") {
      if (intent.status !== "requires_capture") {
        return json(res, 400, { error: { type: "invalid_request_error", code: "payment_intent_unexpected_state", message: `This PaymentIntent could not be captured because it has a status of ${intent.status}.` } });
      }
      const take = form.get("amount_to_capture") === null ? intent.amount : Number(form.get("amount_to_capture"));
      // Never more than was held (overcapture is a separate feature HostFix does not use).
      if (!(take > 0) || take > intent.amount) {
        return json(res, 400, { error: { type: "invalid_request_error", code: "amount_too_large", message: "The amount to capture is more than the amount that can be captured." } });
      }
      intent.status = "succeeded";
      intent.received = take;
      return json(res, 200, intentJson(intent));
    }
    if (intentAction[2] === "cancel") {
      if (intent.status === "succeeded") {
        return json(res, 400, { error: { type: "invalid_request_error", code: "payment_intent_unexpected_state", message: "You cannot cancel this PaymentIntent because it has a status of succeeded." } });
      }
      intent.status = "canceled";
      return json(res, 200, intentJson(intent));
    }
  }

  const lookup = /^\/v1\/checkout\/sessions\/([A-Za-z0-9_]+)$/.exec(url.pathname);
  if (req.method === "GET" && lookup) {
    const session = sessions.get(lookup[1]);
    if (!session) {
      return json(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such checkout.session" } });
    }
    return json(res, 200, sessionJson(session));
  }

  const confirm = /^\/pay\/([A-Za-z0-9_]+)\/confirm$/.exec(url.pathname);
  if (req.method === "GET" && confirm) {
    const session = sessions.get(confirm[1]);
    if (!session) return json(res, 404, { error: "unknown session" });
    session.paid = true;
    res.writeHead(303, { Location: session.successUrl.replace("{CHECKOUT_SESSION_ID}", session.id) });
    return res.end();
  }

  const pay = /^\/pay\/([A-Za-z0-9_]+)$/.exec(url.pathname);
  if (req.method === "GET" && pay) {
    const session = sessions.get(pay[1]);
    if (!session) return json(res, 404, { error: "unknown session" });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pretend card page</title></head>
<body style="font-family: sans-serif; padding: 24px">
  <h1>Pretend card page</h1>
  <p data-testid="amount">${session.amount} ${session.currency}</p>
  <p data-testid="email">${session.email ?? ""}</p>
  <p><a data-testid="pay" href="/pay/${session.id}/confirm">Pay</a></p>
  <p><a data-testid="cancel" href="${session.cancelUrl}">Cancel</a></p>
</body></html>`);
  }

  json(res, 404, { error: { type: "invalid_request_error", message: `Unhandled ${req.method} ${url.pathname}` } });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Pretend Stripe is listening on http://localhost:${PORT}`);
});
