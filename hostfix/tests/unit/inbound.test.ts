import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { getJobForStaff } from "@/lib/jobs/store";
import { handleInboundSms, readClickSend, readReply, replyText, twilioSignatureValid } from "@/lib/notify/inbound";
import { testDb } from "./db";
import { liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor } from "./factory";

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

describe("reading a reply", () => {
  it("understands the ways people say yes and no", () => {
    for (const yes of ["YES", "yes", " Yes please", "Y", "ok", "Okay", "yep", "1", "Accept", '"YES"']) expect(readReply(yes)).toBe("yes");
    for (const no of ["NO", "no thanks", "N", "nah", "pass", "2", "Decline"]) expect(readReply(no)).toBe("no");
    for (const stop of ["STOP", "stop", "Unsubscribe", "STOPALL", "cancel", "End", "QUIT"]) expect(readReply(stop)).toBe("stop");
    for (const start of ["START", "start", "Unstop"]) expect(readReply(start)).toBe("start");
    expect(readReply("Pause")).toBe("pause");
    for (const unclear of ["", "maybe", "what job?", "yesterday", "not sure", "12 Lake St"]) expect(readReply(unclear)).toBeNull();
  });
});

describe("a tradie replying by text", () => {
  async function offered() {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const first = await makeTradie(t.db, { slot: 1 });
    const backup = await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    return { job, first, backup };
  }
  const reply = (from: string, body: string) => handleInboundSms(t.db, { provider: "twilio", from, body, raw: { From: from, Body: body } });

  it("YES takes the job, exactly as the link does", async () => {
    const { job, first } = await offered();
    expect(await reply(first.phone, "YES")).toBe("accepted");
    expect(await getJobForStaff(t.db, job.id)).toMatchObject({ status: "accepted", tradieId: first.tradieId });
    const accepted = await t.db.query<{ detail: { via: string } }>("select detail from public.audit_log where entity_id = $1 and action = 'job.accepted'", [job.id]);
    expect(accepted[0]!.detail.via).toBe("text");
  });

  it("NO passes it on to the backup", async () => {
    const { job, backup } = await offered();
    const { first } = { first: (await offersFor(t.db, job.id))[0]! };
    expect(await reply((await t.db.query<{ phone: string }>("select u.phone from public.tradies t join public.users u on u.id = t.user_id where t.id = $1::uuid", [first.tradie_id]))[0]!.phone, "no")).toBe("passed");
    expect((await offersFor(t.db, job.id)).map((o) => [o.tradie_id, o.status])).toEqual([[first.tradie_id, "passed"], [backup.tradieId, "pending"]]);
  });

  it("a reply from someone with no live offer, or an unknown number, changes nothing", async () => {
    const { job, backup } = await offered();
    expect(await reply(backup.phone, "YES")).toBe("no_offer");
    expect(await reply("+64299999999", "YES")).toBe("unknown_sender");
    expect(await reply("not a number", "YES")).toBe("unknown_sender");
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("offering");
  });

  it("a reply it cannot read is logged and nothing happens", async () => {
    const { job, first } = await offered();
    expect(await reply(first.phone, "Which address is it?")).toBe("not_understood");
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("offering");
    const log = await t.db.query<{ outcome: string; body: string }>("select outcome, body from public.sms_inbound order by created_at");
    expect(log).toEqual([{ outcome: "not_understood", body: "Which address is it?" }]);
  });

  it("PAUSE pauses their offers; STOP stops every text to the number instead (DECISIONS.md, 2026-11-20, third entry)", async () => {
    const { first } = await offered();
    expect(await reply(first.phone, "PAUSE")).toBe("paused");
    expect((await t.db.query<{ status: string }>("select status from public.tradies where id = $1::uuid", [first.tradieId]))[0]!.status).toBe("paused");
  });

  it("a late YES after the 15 minutes is told there is nothing waiting", async () => {
    const { first } = await offered();
    setTestNow(new Date(MONDAY_10AM.getTime() + 16 * 60_000));
    expect(await reply(first.phone, "YES")).toBe("no_offer");
  });

  it("has a short reply for each outcome, never with a link", () => {
    for (const outcome of ["accepted", "passed", "taken", "not_eligible", "paused", "no_offer", "not_understood", "opted_out", "opted_in"] as const) {
      const text = replyText(outcome, "HostFix")!;
      expect(text.startsWith("HostFix:")).toBe(true);
      expect(text.length).toBeLessThanOrEqual(160);
      expect(text).not.toMatch(/https?:/);
    }
    expect(replyText("unknown_sender", "HostFix")).toBeNull();
  });
});

describe("checking a request really came from Twilio", () => {
  // The worked example from Twilio's own security documentation.
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
  const token = "12345";
  const signature = "0/KCTR6DLpKmkAf8muzZqo1nDgQ=";

  it("accepts Twilio's own example", () => {
    expect(twilioSignatureValid(token, url, params, signature)).toBe(true);
  });

  it("refuses a changed field, a changed address, the wrong token or no signature", () => {
    expect(twilioSignatureValid(token, url, { ...params, From: "+12349013031" }, signature)).toBe(false);
    expect(twilioSignatureValid(token, `${url}&x=1`, params, signature)).toBe(false);
    expect(twilioSignatureValid("54321", url, params, signature)).toBe(false);
    expect(twilioSignatureValid(token, url, params, null)).toBe(false);
    expect(twilioSignatureValid(token, url, params, "")).toBe(false);
  });
});

describe("ClickSend replies", () => {
  it("finds the sender and the text under any of the field names it might use", () => {
    expect(readClickSend({ from: "+64211234567", body: "YES" })).toEqual({ from: "+64211234567", body: "YES" });
    expect(readClickSend({ originalsenderid: "+64211234567", message: " yes " })).toEqual({ from: "+64211234567", body: "yes" });
    expect(readClickSend({ to: "+64000", timestamp: "1" })).toBeNull();
    expect(readClickSend({ from: 123, body: "YES" })).toBeNull();
  });
});
