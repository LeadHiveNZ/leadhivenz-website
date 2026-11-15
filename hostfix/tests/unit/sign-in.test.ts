import { afterEach, describe, expect, it } from "vitest";
import { checkCode, CODE_MINUTES, CODES_PER_WINDOW, issueCode, MAX_ATTEMPTS } from "@/lib/auth/codes";
import { createSession, deleteSession, deleteSessionsFor, findSession, SESSION_DAYS } from "@/lib/auth/sessions";
import { AccountExistsError, createUser, findUserByIdentifier, parseIdentifier, viewerFor, type Identifier } from "@/lib/auth/users";
import { addMinutes, DAY, setTestNow } from "@/lib/clock";
import { testDb } from "./db";

const t = testDb();
const SECRET = "test-secret-that-is-at-least-32-characters";
const T0 = new Date("2026-11-15T02:00:00.000Z");
const email: Identifier = { kind: "email", value: "olive@example.com" };

afterEach(() => setTestNow(null));

function code(result: Awaited<ReturnType<typeof issueCode>>): string {
  if (!result.ok) throw new Error("expected a code");
  return result.code;
}

describe("what someone types to sign in", () => {
  it("is read as an email or a mobile", () => {
    expect(parseIdentifier("  Olive@Example.COM ", "NZ")).toEqual({ kind: "email", value: "olive@example.com" });
    expect(parseIdentifier("021 123 4567", "NZ")).toEqual({ kind: "phone", value: "+64211234567" });
    expect(parseIdentifier("0412 345 678", "AU")).toEqual({ kind: "phone", value: "+61412345678" });
    expect(parseIdentifier("not an email", "NZ")).toBeNull();
    expect(parseIdentifier("a@b", "NZ")).toBeNull();
  });
});

describe("sign-in codes", () => {
  it("accepts the right code once, and only once", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    expect(issued).toMatch(/^\d{6}$/);
    expect(await checkCode(t.db, SECRET, email, issued)).toEqual({ ok: true });
    expect(await checkCode(t.db, SECRET, email, issued)).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a code typed with spaces", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    expect(await checkCode(t.db, SECRET, email, `${issued.slice(0, 3)} ${issued.slice(3)}`)).toEqual({ ok: true });
  });

  it("refuses a wrong code and a code for a different address", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    const wrong = issued === "000000" ? "000001" : "000000";
    expect(await checkCode(t.db, SECRET, email, wrong)).toEqual({ ok: false, reason: "wrong" });
    expect(await checkCode(t.db, SECRET, { kind: "email", value: "other@example.com" }, issued)).toEqual({ ok: false, reason: "expired" });
    expect(await checkCode(t.db, SECRET, email, issued)).toEqual({ ok: true });
  });

  it("stops working after ten minutes", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    setTestNow(addMinutes(T0, CODE_MINUTES));
    expect(await checkCode(t.db, SECRET, email, issued)).toEqual({ ok: false, reason: "expired" });
  });

  it("is killed by five wrong guesses, even if the sixth is right", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    const wrong = issued === "111111" ? "222222" : "111111";
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      expect(await checkCode(t.db, SECRET, email, wrong)).toEqual({ ok: false, reason: "wrong" });
    }
    expect(await checkCode(t.db, SECRET, email, wrong)).toEqual({ ok: false, reason: "too_many" });
    expect(await checkCode(t.db, SECRET, email, issued)).toEqual({ ok: false, reason: "too_many" });
  });

  it("makes an older code useless when a new one is sent", async () => {
    setTestNow(T0);
    const first = code(await issueCode(t.db, SECRET, email));
    const second = code(await issueCode(t.db, SECRET, email));
    if (first !== second) expect(await checkCode(t.db, SECRET, email, first)).toEqual({ ok: false, reason: "wrong" });
    expect(await checkCode(t.db, SECRET, email, second)).toEqual({ ok: true });
  });

  it("will not send more than five codes to one address in fifteen minutes", async () => {
    setTestNow(T0);
    for (let i = 0; i < CODES_PER_WINDOW; i += 1) expect((await issueCode(t.db, SECRET, email)).ok).toBe(true);
    expect(await issueCode(t.db, SECRET, email)).toEqual({ ok: false, reason: "too_many" });
    setTestNow(addMinutes(T0, 16));
    expect((await issueCode(t.db, SECRET, email)).ok).toBe(true);
  });

  it("does not accept a code made with a different app secret", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    expect(await checkCode(t.db, "another-secret-that-is-32-characters-long", email, issued)).toEqual({ ok: false, reason: "wrong" });
  });

  it("never stores the code itself", async () => {
    setTestNow(T0);
    const issued = code(await issueCode(t.db, SECRET, email));
    const rows = await t.db.query<{ code_hash: string }>("select code_hash from public.sign_in_codes");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code_hash).not.toContain(issued);
    expect(rows[0]!.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("accounts", () => {
  it("finds a person by email or by mobile", async () => {
    const user = await createUser(t.db, { name: "Olive Owner", email: "olive@example.com", phone: "+64211234567" });
    expect((await findUserByIdentifier(t.db, email))?.id).toBe(user.id);
    expect((await findUserByIdentifier(t.db, { kind: "phone", value: "+64211234567" }))?.id).toBe(user.id);
    expect(await findUserByIdentifier(t.db, { kind: "email", value: "nobody@example.com" })).toBeNull();
  });

  it("will not make a second account with the same email or mobile", async () => {
    await createUser(t.db, { name: "Olive", email: "olive@example.com", phone: "+64211234567" });
    await expect(createUser(t.db, { name: "Other", email: "olive@example.com", phone: null })).rejects.toBeInstanceOf(AccountExistsError);
    await expect(createUser(t.db, { name: "Other", email: null, phone: "+64211234567" })).rejects.toBeInstanceOf(AccountExistsError);
  });

  it("starts a new person with no roles at all", async () => {
    const user = await createUser(t.db, { name: "Nobody Yet", email: "n@example.com", phone: null });
    expect(await viewerFor(t.db, user)).toEqual({ user, ownerId: null, tradieId: null, staffRole: null });
  });
});

describe("signed-in browsers", () => {
  it("knows who a cookie belongs to, and stores only its fingerprint", async () => {
    setTestNow(T0);
    const user = await createUser(t.db, { name: "Olive", email: "olive@example.com", phone: null });
    const { token } = await createSession(t.db, user.id, "Phone browser");
    expect((await findSession(t.db, token))?.user.id).toBe(user.id);

    const rows = await t.db.query<{ token_hash: string }>("select token_hash from public.sessions");
    expect(rows[0]!.token_hash).not.toBe(token);
    expect(await findSession(t.db, rows[0]!.token_hash)).toBeNull();
  });

  it("rejects an unknown, missing or malformed cookie", async () => {
    expect(await findSession(t.db, undefined)).toBeNull();
    expect(await findSession(t.db, "short")).toBeNull();
    expect(await findSession(t.db, "x".repeat(43))).toBeNull();
  });

  it("runs out after 30 days without use, and is renewed by use", async () => {
    setTestNow(T0);
    const user = await createUser(t.db, { name: "Olive", email: "olive@example.com", phone: null });
    const { token } = await createSession(t.db, user.id, null);

    setTestNow(new Date(T0.getTime() + 20 * DAY));
    expect(await findSession(t.db, token)).not.toBeNull();
    // Used on day 20, so it now lasts until day 50.
    setTestNow(new Date(T0.getTime() + (SESSION_DAYS + 15) * DAY));
    expect(await findSession(t.db, token)).not.toBeNull();
    setTestNow(new Date(T0.getTime() + (SESSION_DAYS + 15 + SESSION_DAYS + 1) * DAY));
    expect(await findSession(t.db, token)).toBeNull();
  });

  it("stops working the moment the person signs out", async () => {
    const user = await createUser(t.db, { name: "Olive", email: "olive@example.com", phone: null });
    const { token } = await createSession(t.db, user.id, null);
    await deleteSession(t.db, token);
    expect(await findSession(t.db, token)).toBeNull();
  });

  it("stops working on every device when a person is signed out everywhere or switched off", async () => {
    const user = await createUser(t.db, { name: "Olive", email: "olive@example.com", phone: null });
    const a = await createSession(t.db, user.id, null);
    const b = await createSession(t.db, user.id, null);
    await t.db.query("update public.users set disabled_at = now() where id = $1::uuid", [user.id]);
    expect(await findSession(t.db, a.token)).toBeNull();
    await t.db.query("update public.users set disabled_at = null where id = $1::uuid", [user.id]);
    expect(await findSession(t.db, b.token)).not.toBeNull();
    await deleteSessionsFor(t.db, user.id);
    expect(await findSession(t.db, a.token)).toBeNull();
    expect(await findSession(t.db, b.token)).toBeNull();
  });
});
