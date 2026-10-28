export type Role = "admin" | "qualified" | "apprentice";
export type JobStatus = "scheduled" | "on_the_way" | "on_site" | "done";
export type PhotoKind = "before" | "after" | "issue";
export type RateBand = "standard" | "after_hours" | "night_sunday";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  van: number | null;
  can_do_gas: boolean;
}

export interface Job {
  id: string;
  calendar_event_id: string | null;
  date: string; // YYYY-MM-DD (NZ)
  start_at: string; // ISO
  end_at: string; // ISO
  van: number;
  assigned_to: string[];
  customer_first_name: string;
  customer_phone: string | null;
  address: string;
  suburb: string | null;
  travel_zone: "1" | "2" | "3" | "beyond";
  job_type: string;
  description: string | null;
  access_notes: string | null;
  is_gas: boolean;
  quoted_hours: number | null;
  status: JobStatus;
  completed_at: string | null;
  updated_at: string;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  kind: PhotoKind;
  storage_path: string;
  taken_by: string | null;
  taken_at: string;
}

export interface TimeEntry {
  id: string;
  job_id: string;
  user_id: string;
  minutes: number;
  started_at: string;
  rate_band: RateBand;
}

export interface JobMaterial {
  id: string;
  job_id: string;
  description: string;
  qty: number;
  added_by: string | null;
}

export interface JobNote {
  id: string;
  job_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface JobBundle {
  job: Job;
  photos: JobPhoto[];
  time: TimeEntry[];
  materials: JobMaterial[];
  notes: JobNote[];
}

export interface SyncIssue {
  id: string;
  calendar_event_id: string | null;
  title: string | null;
  starts_at: string | null;
  reason: string;
  resolved: boolean;
}

export const STATUS_ORDER: JobStatus[] = ["scheduled", "on_the_way", "on_site", "done"];

export const STATUS_LABEL: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  on_the_way: "On the way",
  on_site: "On site",
  done: "Done",
};

/** Label on the one big button: what tapping it will do next. */
export const NEXT_ACTION_LABEL: Record<JobStatus, string | null> = {
  scheduled: "On the way",
  on_the_way: "On site",
  on_site: "Done",
  done: null,
};

export function nextStatus(s: JobStatus): JobStatus | null {
  const i = STATUS_ORDER.indexOf(s);
  return i >= 0 && i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
}
