import type { LineKind } from "./pricing";

/** The shapes of a job and the things attached to it. */

export type JobStatus =
  | "awaiting_owner"
  | "offering"
  | "unfilled"
  | "accepted"
  | "on_site"
  | "awaiting_approval"
  | "completed"
  | "cancelled";

export type ReportedBy = "owner" | "team" | "guest" | "staff";
export type JobOutcome = "done" | "diagnosis_only" | "no_access";

export type Job = {
  id: string;
  number: number;
  createdAt: Date;
  propertyId: string;
  ownerId: string;
  market: string;
  menuItemId: string | null;
  offMenu: boolean;
  trade: string;
  licenceRequired: boolean;
  title: string;
  description: string;
  urgency: "standard" | "urgent";
  afterHours: boolean;
  reportedBy: ReportedBy;
  reporterName: string | null;
  reporterPhone: string | null;
  status: JobStatus;
  stage: number;
  offerRound: number;
  tradieId: string | null;
  tierKey: string | null;
  responseHours: number;
  dispatchedAt: Date | null;
  respondBy: Date | null;
  acceptedAt: Date | null;
  enRouteAt: Date | null;
  arrivedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  windowMissedAt: Date | null;
  outcome: JobOutcome | null;
  completionNote: string | null;
  currency: string;
  ownerTotalCents: number;
  tradieTotalCents: number;
  taxCents: number;
  /** The owner's team member who reported it from their own team link, if one did. */
  teamMemberId?: string | null;
};

export type JobLine = {
  id: string;
  jobId: string;
  kind: LineKind;
  label: string;
  ownerCents: number;
  tradieCents: number;
  status: "active" | "pending" | "void";
  quoteId: string | null;
};

export type OfferStatus = "pending" | "accepted" | "passed" | "expired" | "superseded";

export type Offer = {
  id: string;
  number: number;
  jobId: string;
  tradieId: string;
  stage: number;
  round: number;
  status: OfferStatus;
  sentAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  respondedVia: "link" | "text" | "app" | "staff" | null;
  payoutCents: number;
};

export type QuoteStatus = "pending" | "approved" | "auto_approved" | "declined" | "withdrawn";

export type Quote = {
  id: string;
  createdAt: Date;
  jobId: string;
  tradieId: string;
  description: string;
  labourCents: number;
  partsCents: number;
  ownerTotalCents: number;
  tradieTotalCents: number;
  needsApproval: boolean;
  status: QuoteStatus;
  decidedAt: Date | null;
  decidedBy: string | null;
};

/** A job is "open" while something still has to happen on it. */
export const OPEN_STATUSES: JobStatus[] = ["awaiting_owner", "offering", "unfilled", "accepted", "on_site", "awaiting_approval"];

export function isOpen(status: JobStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** What each status is called on screen. Owners never see "nobody accepted". */
export function statusLabel(status: JobStatus, audience: "owner" | "tradie" | "staff" = "owner"): string {
  switch (status) {
    case "awaiting_owner":
      return audience === "owner" ? "Waiting for your go-ahead" : "Waiting for the owner";
    case "offering":
      return audience === "tradie" ? "On offer" : "Finding a tradie";
    case "unfilled":
      return audience === "staff" ? "Nobody accepted" : "Our team is arranging a tradie";
    case "accepted":
      return "Tradie booked";
    case "on_site":
      return "Tradie on site";
    case "awaiting_approval":
      return audience === "owner" ? "Quote waiting for you" : "Waiting for the owner's answer";
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
  }
}

export type StatusTone = "waiting" | "active" | "done" | "quiet" | "alert";

/** The colour family for a status: amber waiting, blue under way, green done, grey closed, red needs attention. */
export function statusTone(status: JobStatus, audience: "owner" | "tradie" | "staff" = "owner"): StatusTone {
  switch (status) {
    case "awaiting_owner":
    case "awaiting_approval":
      return audience === "owner" ? "alert" : "waiting";
    case "offering":
      return "waiting";
    case "unfilled":
      return audience === "staff" ? "alert" : "waiting";
    case "accepted":
    case "on_site":
      return "active";
    case "completed":
      return "done";
    case "cancelled":
      return "quiet";
  }
}
