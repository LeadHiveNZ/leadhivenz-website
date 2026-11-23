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

/**
 * What the app made of a tap's location (Arrived or Job done).
 * ok: within 300 m of the property's pin (or, with no pin, of where trusted
 * arrivals at this property were). far: more than 300 m from it.
 * no_location: the phone gave no location.
 * no_reference: a location, but nothing yet to compare it with.
 */
export type ArrivalCheck = "ok" | "far" | "no_location" | "no_reference";

/** A flagged job's check (DECISIONS.md, 2026-11-19). Null on a job with no flags. */
export type ConfirmStatus = "waiting" | "owner_confirmed" | "owner_problem" | "released_trusted" | "staff_queue" | "staff_approved" | "staff_held";

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
  /** The arrival window the tradie chose when accepting. On time means arrived by its end (DECISIONS.md, 2026-11-18). */
  arrivalWindowStart: Date | null;
  arrivalWindowEnd: Date | null;
  /** Set when an accepted job reached its promised time with nobody on site. */
  noShowAt: Date | null;
  /** What the app made of the Arrived tap's location. */
  arrivalCheck: ArrivalCheck | null;
  arrivalDistanceM: number | null;
  arrivedLat: number | null;
  arrivedLng: number | null;
  /** The owner pressed "The tradie isn't here". */
  ownerSaysAbsentAt: Date | null;
  /** What the taps were measured against: the property's pin, earlier trusted taps, this job's own Arrived tap, or nothing. */
  checkReference: "pin" | "earlier_taps" | "own_arrival" | "none" | null;
  /** Where the phone was at Job done (or Could not get in), and what the app made of it. */
  finishedLat: number | null;
  finishedLng: number | null;
  finishCheck: ArrivalCheck | null;
  finishDistanceM: number | null;
  minutesOnSite: number | null;
  /** Why the job was flagged at Job done. Empty when it was not. */
  checkFlags: string[];
  confirmStatus: ConfirmStatus | null;
  /** When the owner's answer on a flagged job is due. */
  confirmBy: Date | null;
  confirmDecidedAt: Date | null;
  confirmDecidedBy: string | null;
  /**
   * Held before going out because the owner's card could not be charged: no_card, expired, unpaid (DECISIONS.md,
   * 2026-11-20); declined: the hold on the card was declined; placing: the hold is being placed (2026-11-23).
   */
  cardHold: "no_card" | "expired" | "unpaid" | "declined" | "placing" | null;
  /** A far-off visit: when the hold on the owner's card is placed, a day before it (DECISIONS.md, 2026-11-23). */
  holdDueAt: Date | null;
  /** The platform fee on this job when it is not the market's: 500 on a job between an own-client pair (DECISIONS.md, 2026-11-23). */
  platformFeeBps: number | null;
  /** Is a guest staying, and who: their first name and mobile, for this job's texts only. */
  guestStaying: "yes" | "no" | "not_sure" | null;
  guestName: string | null;
  guestPhone: string | null;
  /** The owner said: if nobody answers, the tradie may let themselves in. */
  mayLetIn: boolean;
  /** "Not the job described" on a menu job (DECISIONS.md, 2026-11-20, third entry). */
  notDescribedAt: Date | null;
  notDescribedReason: string | null;
  notDescribedStatus: "waiting" | "approved" | "no_objection" | "owner_objects" | "staff_paid" | "staff_no_callout" | null;
  /** Until when the owner can say "This was the job I described". */
  notDescribedBy: Date | null;
  outcome: JobOutcome | null;
  completionNote: string | null;
  currency: string;
  ownerTotalCents: number;
  tradieTotalCents: number;
  /** What the lower fee above NZ$1,000 adds to the tradie's share (DECISIONS.md, 2026-11-23, second entry). In tradieTotalCents. */
  tierReliefCents: number;
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
  /** Work up to the hourly limit is quoted in hours at the market's fixed rate (DECISIONS.md, 2026-11-20, third entry). */
  hours: number | null;
  rateCents: number | null;
  /** An off-menu job's call-out taken off this quote, owner side. */
  creditCents: number;
  /** Sent with "Not the job described". */
  notDescribed: boolean;
  /** It takes the job over NZ$1,000: approving it takes a 50% deposit first (DECISIONS.md, 2026-11-23, second entry). */
  deposit: boolean;
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
