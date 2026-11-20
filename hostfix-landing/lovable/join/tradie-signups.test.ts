// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { validateSignup, checkFile } from "@/lib/tradie-signup";

const { insert, from, upload, remove, signed, storageFrom } = vi.hoisted(() => ({
  insert: vi.fn(), from: vi.fn(), upload: vi.fn(), remove: vi.fn(), signed: vi.fn(), storageFrom: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from, storage: { from: storageFrom } } }));
import { Route } from "@/routes/api/public/tradie-signups";

const post = (Route as unknown as { server: { handlers: { POST: (c: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
const ORIGIN = "https://hostfix-queenstown.lovable.app";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const fields: Record<string, string | string[]> = {
  full_name: "Test Tradie", phone: "021 123 4567", email: "t@example.com", gst_registered: "no",
  trades: ["plumber", "handyman"], towns: "Queenstown, Arrowtown", work_days: ["Mon", "Tue"],
  licence_number_plumber: "PL123", licence_expiry_plumber: "2099-01-01",
  insurer: "Vero", policy_number: "P-1", insurance_expiry: "2099-06-30",
  agree_terms: "yes", agree_contractor: "yes", agree_true: "yes", signature_name: "test tradie", record_requested: "yes",
};
function form(over: Record<string, string | string[] | null> = {}, files: { insurance?: File | null; record?: File | null } = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ ...fields, ...over })) {
    if (v === null) continue;
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  const ins = files.insurance === undefined ? new File([PDF], "cert.pdf", { type: "application/pdf" }) : files.insurance;
  if (ins) f.append("insurance_file", ins);
  if (files.record) f.append("record_file", files.record);
  return f;
}
const req = (body: FormData, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/public/tradie-signups`, { method: "POST", headers: { origin: ORIGIN, "cf-connecting-ip": "203.0.113.5", "user-agent": "TestUA", ...headers }, body });

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
  storageFrom.mockReturnValue({ upload, remove, createSignedUrl: signed });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  signed.mockResolvedValue({ data: { signedUrl: "https://signed.example/doc" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("RESEND_API_KEY", "");
});

const TODAY = "2026-11-20";
const v = (f: FormData) => validateSignup(f, { insurance: f.get("insurance_file") as File | null, record: (f.get("record_file") as File | null) ?? null }, TODAY);

it("accepts a complete signup and keeps only the licensed trade's licence", () => {
  const r = v(form());
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data.licences).toEqual([{ trade: "plumber", number: "PL123", expiry: "2099-01-01" }]);
});
it.each([
  [{ trades: [] }, "trades"],
  [{ licence_number_plumber: null }, "licence_number_plumber"],
  [{ licence_expiry_plumber: "2026-11-19" }, "licence_expiry_plumber"],
  [{ insurance_expiry: "2020-01-01" }, "insurance_expiry"],
  [{ signature_name: "Someone Else" }, "signature_name"],
  [{ agree_contractor: null }, "agree_contractor"],
  [{ gst_registered: "yes" }, "gst_number"],
  [{ record_requested: null }, "record_file"],
  [{ phone: "123" }, "phone"],
  [{ trades: ["builder"] }, "trades"],
])("rejects %j", (over, key) => {
  const r = v(form(over));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors[key]).toBeTruthy();
});
it("requires the insurance certificate", () => {
  const r = v(form({}, { insurance: null }));
  expect(!r.ok && r.errors["insurance_file"]).toBeTruthy();
});
it("checks files by extension, content type and 10 MB size", () => {
  expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 10 })).toBe("pdf");
  expect(checkFile({ name: "a.JPEG", type: "image/jpeg", size: 10 })).toBe("jpg");
  expect(checkFile({ name: "a.pdf", type: "image/png", size: 10 })).toBeNull();
  expect(checkFile({ name: "a.exe", type: "application/pdf", size: 10 })).toBeNull();
  expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).toBeNull();
});

it("uploads documents, then saves the signup with IP, agent, version and agreement hash", async () => {
  const res = await post({ request: req(form({}, { record: new File([PNG], "rec.png", { type: "image/png" }) })) });
  expect(res.status).toBe(200);
  expect(storageFrom).toHaveBeenCalledWith("tradie-docs");
  const paths = upload.mock.calls.map((c) => c[0]);
  expect(paths[0]).toMatch(/^signups\/[0-9a-f-]{36}\/insurance\.pdf$/);
  expect(paths[1]).toMatch(/^signups\/[0-9a-f-]{36}\/record\.png$/);
  expect(from).toHaveBeenCalledWith("tradie_signups");
  const row = insert.mock.calls[0]![0];
  expect(row).toMatchObject({ full_name: "Test Tradie", gst_registered: false, trades: ["plumber", "handyman"], signer_ip: "203.0.113.5", signer_user_agent: "TestUA", agreement_version: "21 November 2026", insurance_file_path: paths[0], record_file_path: paths[1], record_requested: false });
  expect(row.agreement_sha256).toMatch(/^[0-9a-f]{64}$/);
});
it("refuses a file whose contents don't match its type", async () => {
  const fake = new File([new Uint8Array([1, 2, 3, 4])], "cert.pdf", { type: "application/pdf" });
  expect((await post({ request: req(form({}, { insurance: fake })) })).status).toBe(400);
  expect(insert).not.toHaveBeenCalled();
});
it("rejects invalid fields before uploading anything", async () => {
  expect((await post({ request: req(form({ signature_name: "Nope" })) })).status).toBe(400);
  expect(upload).not.toHaveBeenCalled();
});
it.each(["origin", "sec-fetch-site"])("rejects cross-site %s", async (h) => {
  expect((await post({ request: req(form(), { [h]: h === "origin" ? "https://evil.example" : "cross-site" }) })).status).toBe(403);
  expect(upload).not.toHaveBeenCalled();
});
it("rejects JSON bodies", async () => {
  const r = new Request(`${ORIGIN}/api/public/tradie-signups`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" });
  expect((await post({ request: r })).status).toBe(415);
});
it("removes uploaded files if the row can't be saved", async () => {
  insert.mockResolvedValue({ error: { code: "x" } });
  expect((await post({ request: req(form()) })).status).toBe(500);
  expect(remove).toHaveBeenCalled();
});
it("still succeeds when the email fails, and emails with the signed subject and 7-day links", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  const fetchMock = vi.fn().mockResolvedValue(new Response("no", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  const res = await post({ request: req(form()) });
  expect(await res.json()).toEqual({ ok: true, emailed: false });
  expect(insert).toHaveBeenCalled();
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
  expect(body.subject).toBe("Tradie signed: Test Tradie, Plumber, Handyman (Queenstown, Arrowtown)");
  expect(body.text).toContain("https://signed.example/doc");
  expect(signed).toHaveBeenCalledWith(expect.any(String), 604800);
});
