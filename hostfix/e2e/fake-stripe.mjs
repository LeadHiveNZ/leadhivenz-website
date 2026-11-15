// A stand-in for Stripe, used only by the automated browser tests.
// It understands just enough of Stripe's API for the deposit journey:
//   POST /v1/checkout/sessions        create a card page
//   GET  /v1/checkout/sessions/:id    look one up
//   GET  /pay/:id                     the pretend card page (Pay or Cancel)
//   GET  /pay/:id/confirm             "the card went through"
// No real money, no real network.

import { randomBytes } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.FAKE_STRIPE_PORT ?? 3299);
const sessions = new Map();

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
