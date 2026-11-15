import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AuditEntry,
  DepositPaidArgs,
  DepositRefundedArgs,
  DepositStartedArgs,
  Lead,
  LeadCounts,
  LeadStore,
  LeadType,
  NewLead,
  NotificationRecord,
  StoredNotification,
} from "./types";

/**
 * DEMO STORE
 * Keeps everything in one JSON file on this computer. It behaves the same way
 * as the real database (the shared tests in tests/store-contract.ts prove it)
 * so the site can be tried before any accounts exist. It is never used on the
 * live site: see demoModeAllowed() in src/lib/env.ts.
 */

type StoredAudit = Required<Omit<AuditEntry, "detail">> & { detail: Record<string, unknown>; at: string };

type DemoData = {
  leads: Lead[];
  notifications: StoredNotification[];
  audit: StoredAudit[];
  rateLimits: Record<string, { hits: number; expiresAt: number }>;
};

function emptyData(): DemoData {
  return { leads: [], notifications: [], audit: [], rateLimits: {} };
}

export function demoDataFile(): string {
  const dir = process.env.HOSTFIX_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
  return path.join(dir, "demo-db.json");
}

export class DemoStore implements LeadStore {
  readonly kind = "demo" as const;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string = demoDataFile()) {}

  private async read(): Promise<DemoData> {
    try {
      const text = await readFile(this.file, "utf8");
      const parsed = JSON.parse(text) as Partial<DemoData>;
      return { ...emptyData(), ...parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyData();
      throw error;
    }
  }

  private async write(data: DemoData): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2), "utf8");
    await rename(temp, this.file);
  }

  /** Runs one read-change-write at a time so two requests cannot clash. */
  private change<T>(fn: (data: DemoData) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const result = fn(data);
      await this.write(data);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private pushAudit(data: DemoData, entry: AuditEntry): boolean {
    if (entry.dedupeKey && data.audit.some((a) => a.dedupeKey === entry.dedupeKey)) return false;
    data.audit.push({
      at: new Date().toISOString(),
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      amount: entry.amount ?? null,
      currency: entry.currency ?? null,
      detail: entry.detail ?? {},
      dedupeKey: entry.dedupeKey ?? null,
    });
    return true;
  }

  async insertLead(input: NewLead): Promise<Lead> {
    if (input.leadType === "owner" && (input.email === null || input.propertyCount === null)) {
      throw new Error("An owner lead needs an email and a property count.");
    }
    if (input.leadType === "tradie" && input.trade === null) {
      throw new Error("A tradie lead needs a trade.");
    }
    return this.change((data) => {
      const lead: Lead = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        depositStatus: "none",
        depositAmount: null,
        depositCurrency: null,
        stripeAccount: null,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        stripeCustomerId: null,
        depositPaidAt: null,
        depositRefundedAt: null,
      };
      data.leads.push(lead);
      this.pushAudit(data, {
        actor: "system",
        action: "lead.created",
        entity: "lead",
        entityId: lead.id,
        detail: { lead_type: lead.leadType, market: lead.market, source: lead.source },
      });
      return lead;
    });
  }

  async findRecentLead(leadType: LeadType, phone: string, sinceIso: string): Promise<Lead | null> {
    const data = await this.read();
    const matches = data.leads
      .filter((l) => l.leadType === leadType && l.phone === phone && l.createdAt >= sinceIso)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  }

  async getLead(id: string): Promise<Lead | null> {
    const data = await this.read();
    return data.leads.find((l) => l.id === id) ?? null;
  }

  async listLeads(options: { leadType?: LeadType; limit: number }): Promise<Lead[]> {
    const data = await this.read();
    return data.leads
      .filter((l) => !options.leadType || l.leadType === options.leadType)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, options.limit);
  }

  async countLeads(): Promise<LeadCounts> {
    const data = await this.read();
    const totals = new Map<string, number>();
    let depositsPaid = 0;
    for (const lead of data.leads) {
      if (lead.depositStatus === "paid" && lead.depositAmount && lead.depositCurrency) {
        depositsPaid += 1;
        totals.set(lead.depositCurrency, (totals.get(lead.depositCurrency) ?? 0) + lead.depositAmount);
      }
    }
    return {
      owners: data.leads.filter((l) => l.leadType === "owner").length,
      tradies: data.leads.filter((l) => l.leadType === "tradie").length,
      depositsPaid,
      depositTotals: [...totals].map(([currency, cents]) => ({ currency, cents })),
    };
  }

  async markDepositStarted(args: DepositStartedArgs): Promise<Lead | null> {
    return this.change((data) => {
      const lead = data.leads.find((l) => l.id === args.leadId);
      if (!lead || lead.leadType !== "owner") return null;
      if (lead.depositStatus !== "none" && lead.depositStatus !== "started") return null;
      lead.depositStatus = "started";
      lead.depositAmount = args.amount;
      lead.depositCurrency = args.currency.toUpperCase();
      lead.stripeAccount = args.stripeAccount;
      lead.stripeCheckoutSessionId = args.checkoutSessionId;
      this.pushAudit(data, {
        actor: "system",
        action: "deposit.started",
        entity: "lead",
        entityId: lead.id,
        amount: args.amount,
        currency: args.currency.toUpperCase(),
        detail: { stripe_account: args.stripeAccount, checkout_session: args.checkoutSessionId },
      });
      return { ...lead };
    });
  }

  async recordDepositPaid(args: DepositPaidArgs): Promise<Lead | null> {
    return this.change((data) => {
      const lead = data.leads.find((l) => l.id === args.leadId);
      if (!lead) return null;
      if (lead.depositStatus !== "none" && lead.depositStatus !== "started") return null;
      lead.depositStatus = "paid";
      lead.depositAmount = args.amount;
      lead.depositCurrency = args.currency.toUpperCase();
      lead.stripeAccount = args.stripeAccount;
      lead.stripeCheckoutSessionId = args.checkoutSessionId;
      lead.stripePaymentIntentId = args.paymentIntentId;
      lead.stripeCustomerId = args.customerId;
      lead.depositPaidAt = new Date().toISOString();
      this.pushAudit(data, {
        actor: "stripe",
        action: "deposit.paid",
        entity: "lead",
        entityId: lead.id,
        amount: args.amount,
        currency: args.currency.toUpperCase(),
        detail: {
          stripe_account: args.stripeAccount,
          checkout_session: args.checkoutSessionId,
          payment_intent: args.paymentIntentId,
        },
      });
      return { ...lead };
    });
  }

  async recordDepositRefunded(args: DepositRefundedArgs): Promise<Lead | null> {
    return this.change((data) => {
      const lead = data.leads.find((l) => l.stripePaymentIntentId === args.paymentIntentId);
      if (!lead) return null;
      const dedupeKey = `stripe:${args.eventId}`;
      if (data.audit.some((a) => a.dedupeKey === dedupeKey)) return null;
      if (args.fullyRefunded) {
        lead.depositStatus = "refunded";
        lead.depositRefundedAt = new Date().toISOString();
      }
      this.pushAudit(data, {
        actor: "stripe",
        action: args.fullyRefunded ? "deposit.refunded" : "deposit.part_refunded",
        entity: "lead",
        entityId: lead.id,
        amount: args.amountRefunded,
        currency: lead.depositCurrency,
        detail: { payment_intent: args.paymentIntentId, stripe_event: args.eventId },
        dedupeKey,
      });
      return { ...lead };
    });
  }

  async logNotification(record: NotificationRecord): Promise<void> {
    await this.change((data) => {
      data.notifications.push({ ...record, createdAt: new Date().toISOString() });
    });
  }

  async listNotifications(leadIds: string[]): Promise<StoredNotification[]> {
    if (leadIds.length === 0) return [];
    const wanted = new Set(leadIds);
    const data = await this.read();
    return data.notifications.filter((n) => n.leadId && wanted.has(n.leadId));
  }

  async audit(entry: AuditEntry): Promise<boolean> {
    return this.change((data) => this.pushAudit(data, entry));
  }

  async rateLimitHit(key: string, windowSeconds: number, maxHits: number): Promise<boolean> {
    if (windowSeconds < 1 || maxHits < 1) throw new Error("rateLimitHit: window and max must be positive");
    return this.change((data) => {
      const now = Date.now();
      for (const [bucket, value] of Object.entries(data.rateLimits)) {
        if (value.expiresAt < now) delete data.rateLimits[bucket];
      }
      const bucket = `${key}:${Math.floor(now / 1000 / windowSeconds)}`;
      const current = data.rateLimits[bucket] ?? { hits: 0, expiresAt: now + windowSeconds * 2000 };
      current.hits += 1;
      data.rateLimits[bucket] = current;
      return current.hits <= maxHits;
    });
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    const data = await this.read();
    return { ok: true, detail: `Demo mode: ${data.leads.length} lead(s) saved in a file on this computer only.` };
  }

  /** For tests: the audit entries written so far. */
  async auditEntries(): Promise<StoredAudit[]> {
    const data = await this.read();
    return data.audit;
  }
}
