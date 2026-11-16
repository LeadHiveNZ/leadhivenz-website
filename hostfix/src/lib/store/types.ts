/**
 * The shapes of the lead data we keep, and the list of things the app can ask
 * the database to do with leads. The one implementation is sql.ts.
 */

export type LeadType = "owner" | "tradie";
/** Which button an owner pressed: take a founding spot (the deposit), or just send the price list. */
export type LeadIntent = "deposit" | "pricelist";
export type DepositStatus = "none" | "started" | "paid" | "refunded" | "credited";

export type Lead = {
  id: string;
  createdAt: string;
  leadType: LeadType;
  market: string;
  name: string;
  /** International format, for example +64211234567. */
  phone: string;
  email: string | null;

  propertyCount: number | null;
  managedBy: string | null;
  ownerLocation: string | null;
  /** Owners only. Null for tradies, and for owners who used the older single-button form. */
  intent: LeadIntent | null;

  trade: string | null;
  licenceNumber: string | null;
  daysAvailable: string[] | null;

  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  refCode: string | null;
  referrer: string | null;
  landingPath: string | null;

  depositStatus: DepositStatus;
  /** Cents. */
  depositAmount: number | null;
  depositCurrency: string | null;
  stripeAccount: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  depositPaidAt: string | null;
  depositRefundedAt: string | null;
  /** When this lead became a signed-up owner or an approved tradie. */
  convertedAt: string | null;
  /** When they were last invited to sign up. */
  invitedAt: string | null;
};

/** What is needed to create a lead. The database fills in the rest. */
export type NewLead = Pick<
  Lead,
  | "leadType"
  | "market"
  | "name"
  | "phone"
  | "email"
  | "propertyCount"
  | "managedBy"
  | "ownerLocation"
  | "intent"
  | "trade"
  | "licenceNumber"
  | "daysAvailable"
  | "source"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "utmTerm"
  | "fbclid"
  | "gclid"
  | "refCode"
  | "referrer"
  | "landingPath"
>;

export type NotificationChannel = "sms" | "email";
export type NotificationStatus = "queued" | "sent" | "failed" | "skipped" | "demo";

export type NotificationRecord = {
  channel: NotificationChannel;
  template: string;
  recipient: string;
  status: NotificationStatus;
  provider?: string | null;
  providerMessageId?: string | null;
  error?: string | null;
  leadId?: string | null;
};

export type StoredNotification = NotificationRecord & { createdAt: string };

export type AuditEntry = {
  actor: string;
  action: string;
  entity: string;
  entityId?: string | null;
  /** Cents, for money movements. */
  amount?: number | null;
  currency?: string | null;
  detail?: Record<string, unknown>;
  /** If set, an entry with the same key is only ever stored once. */
  dedupeKey?: string | null;
};

export type LeadCounts = {
  owners: number;
  tradies: number;
  depositsPaid: number;
  depositTotals: { currency: string; cents: number }[];
};

export type DepositStartedArgs = {
  leadId: string;
  stripeAccount: string;
  checkoutSessionId: string;
  amount: number;
  currency: string;
};

export type DepositPaidArgs = {
  leadId: string;
  stripeAccount: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  customerId: string | null;
  amount: number;
  currency: string;
};

export type DepositRefundedArgs = {
  paymentIntentId: string;
  amountRefunded: number;
  fullyRefunded: boolean;
  /** The payment company's ID for this event. A repeat is ignored. */
  eventId: string;
};

export interface LeadStore {
  readonly kind: "postgres" | "demo";

  insertLead(lead: NewLead): Promise<Lead>;
  /** The newest lead of this type and phone number created at or after `sinceIso`. */
  findRecentLead(leadType: LeadType, phone: string, sinceIso: string): Promise<Lead | null>;
  getLead(id: string): Promise<Lead | null>;
  /** Newest first. */
  listLeads(options: { leadType?: LeadType; limit: number }): Promise<Lead[]>;
  countLeads(): Promise<LeadCounts>;

  /**
   * Records which button an owner pressed. Taking a founding spot always wins:
   * someone who asked for the price list and comes back for the deposit is
   * recorded as wanting the spot, never the other way round.
   */
  recordIntent(leadId: string, intent: LeadIntent): Promise<Lead | null>;

  /** Each returns the lead when something changed, or null when nothing did. */
  markDepositStarted(args: DepositStartedArgs): Promise<Lead | null>;
  recordDepositPaid(args: DepositPaidArgs): Promise<Lead | null>;
  recordDepositRefunded(args: DepositRefundedArgs): Promise<Lead | null>;

  logNotification(record: NotificationRecord): Promise<void>;
  listNotifications(leadIds: string[]): Promise<StoredNotification[]>;

  /** Returns false when an entry with the same dedupe key already existed. */
  audit(entry: AuditEntry): Promise<boolean>;

  /** Counts one hit. Returns true while the caller is inside the limit. */
  rateLimitHit(key: string, windowSeconds: number, maxHits: number): Promise<boolean>;

  health(): Promise<{ ok: boolean; detail: string }>;
}

export class StoreNotConfiguredError extends Error {
  constructor() {
    super("The database is not connected yet. Add DATABASE_URL (see SETUP.md).");
    this.name = "StoreNotConfiguredError";
  }
}
