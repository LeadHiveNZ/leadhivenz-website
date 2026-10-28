"use client";
import { useCallback, useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { StatusChip } from "@/components/StatusChip";
import { TopBar } from "@/components/TopBar";
import { loadJob, photoUrl } from "@/lib/data";
import { getBlob } from "@/lib/offline/db";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtDateTime, fmtHours, fmtTime, RATE_BAND_LABEL } from "@/lib/time";
import { STATUS_LABEL, STATUS_ORDER, type Job, type JobBundle, type JobStatus } from "@/lib/types";
import { useCrew } from "../../../../(crew)/CrewContext";

export function OfficeJob({ jobId }: { jobId: string }) {
  const { crew } = useCrew();
  const [bundle, setBundle] = useState<JobBundle | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await loadJob(jobId);
    setBundle(r.data);
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (bundle === undefined) return <Shell title="Job"><p className="py-10 text-center text-muted">Loading…</p></Shell>;
  if (bundle === null) return <Shell title="Job"><p className="py-10 text-center text-muted">Job not found.</p></Shell>;

  const { job } = bundle;
  const name = (id: string) => crew.find((c) => c.id === id)?.name ?? "Crew";
  const minutes = bundle.time.reduce((s, t) => s + t.minutes, 0);
  const quotedMin = job.quoted_hours != null ? Math.round(job.quoted_hours * 60) : null;

  async function save(patch: Partial<Job>) {
    setError(null);
    const { error } = await supabaseBrowser().from("jobs").update(patch).eq("id", job.id);
    if (error) {
      setError(error.message);
      return false;
    }
    await load();
    return true;
  }

  return (
    <Shell title={`${job.customer_first_name} · ${job.job_type}`} right={<StatusChip status={job.status} />}>
      {error && <p className="rounded-xl bg-danger/10 p-3 font-semibold text-danger">{error}</p>}

      {!editing ? (
        <section className="card p-4">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row k="When" v={`${fmtDateTime(job.start_at)} – ${fmtTime(job.end_at)}`} />
            <Row k="Van" v={brand.vans.find((v) => v.id === job.van)?.label ?? `Van ${job.van}`} />
            <Row k="Crew" v={job.assigned_to.map(name).join(", ") || "—"} />
            <Row k="Phone" v={job.customer_phone ?? "—"} />
            <Row k="Address" v={`${job.address}${job.suburb ? ", " + job.suburb : ""}`} />
            <Row k="Travel zone" v={job.travel_zone === "1" ? "Zone 1 (included)" : job.travel_zone === "beyond" ? "Beyond zone 3" : `Zone ${job.travel_zone}`} />
            <Row k="Gas job" v={job.is_gas ? "Yes" : "No"} />
            <Row k="Quoted hours" v={job.quoted_hours != null ? `${job.quoted_hours} h` : "—"} />
            <Row k="Access notes" v={job.access_notes ?? "—"} />
            <Row k="Description" v={job.description ?? "—"} />
            <Row k="Completed" v={job.completed_at ? fmtDateTime(job.completed_at) : "—"} />
            <Row k="Calendar event" v={job.calendar_event_id ?? "—"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary sm:w-auto" onClick={() => setEditing(true)}>
              Edit job
            </button>
            <select
              className="input sm:w-auto"
              value={job.status}
              onChange={(e) => save({ status: e.target.value as JobStatus })}
              aria-label="Set status"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : (
        <EditForm job={job} onCancel={() => setEditing(false)} onSave={async (p) => (await save(p)) && setEditing(false)} />
      )}

      <section className="card p-4">
        <h3 className="text-lg">Photos ({bundle.photos.length})</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {bundle.photos.map((p) => (
            <Thumb key={p.id} path={p.storage_path} label={`${p.kind} · ${fmtTime(p.taken_at)}`} />
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg">Hours</h3>
          <span className={`font-bold ${quotedMin != null && minutes > quotedMin ? "text-danger" : ""}`}>
            {fmtHours(minutes)}
            {quotedMin != null && ` / ${job.quoted_hours} h quoted`}
          </span>
        </div>
        <table className="mt-2 w-full text-left">
          <tbody>
            {bundle.time.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="py-2">{name(t.user_id)}</td>
                <td className="py-2">{fmtHours(t.minutes)}</td>
                <td className="py-2 text-muted">{RATE_BAND_LABEL[t.rate_band]}</td>
                <td className="py-2 text-muted">{fmtDateTime(t.started_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h3 className="text-lg">Materials ({bundle.materials.length})</h3>
        <ul className="mt-2">
          {bundle.materials.map((m) => (
            <li key={m.id} className="border-t border-line py-2">
              {m.qty} × {m.description}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h3 className="text-lg">Notes ({bundle.notes.length})</h3>
        <ul className="mt-2 space-y-2">
          {bundle.notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-page p-3">
              <p className="whitespace-pre-wrap">{n.text}</p>
              <p className="mt-1 text-sm text-muted">
                {name(n.user_id)} · {fmtDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

function Shell({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/office" title={title} right={right} />
      <main className="mx-auto max-w-4xl space-y-3 px-3 pt-3">{children}</main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{k}</p>
      <p className="whitespace-pre-wrap">{v}</p>
    </div>
  );
}

function Thumb({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    photoUrl(path, getBlob).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <a href={url ?? undefined} target="_blank" rel="noopener" className="block">
      <div className="aspect-square overflow-hidden rounded-lg bg-page">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={label} className="h-full w-full object-cover" />}
      </div>
      <p className="mt-1 truncate text-xs text-muted">{label}</p>
    </a>
  );
}

function EditForm({ job, onSave, onCancel }: { job: Job; onSave: (p: Partial<Job>) => Promise<unknown>; onCancel: () => void }) {
  const { crew } = useCrew();
  const [f, setF] = useState({
    customer_first_name: job.customer_first_name,
    customer_phone: job.customer_phone ?? "",
    address: job.address,
    suburb: job.suburb ?? "",
    travel_zone: job.travel_zone,
    job_type: job.job_type,
    description: job.description ?? "",
    access_notes: job.access_notes ?? "",
    is_gas: job.is_gas,
    quoted_hours: job.quoted_hours?.toString() ?? "",
    van: job.van,
    assigned_to: job.assigned_to,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const gasBlocked = f.is_gas ? crew.filter((c) => f.assigned_to.includes(c.id) && !c.can_do_gas) : [];

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (gasBlocked.length) return;
        void onSave({
          customer_first_name: f.customer_first_name.trim(),
          customer_phone: f.customer_phone.trim() || null,
          address: f.address.trim(),
          suburb: f.suburb.trim() || null,
          travel_zone: f.travel_zone,
          job_type: f.job_type.trim(),
          description: f.description.trim() || null,
          access_notes: f.access_notes.trim() || null,
          is_gas: f.is_gas,
          quoted_hours: f.quoted_hours === "" ? null : Number(f.quoted_hours),
          van: f.van,
          assigned_to: f.assigned_to,
        });
      }}
    >
      <h3 className="text-lg">Edit job</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <L label="Customer first name"><input className="input" value={f.customer_first_name} onChange={(e) => set("customer_first_name", e.target.value)} required /></L>
        <L label="Phone"><input className="input" value={f.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} /></L>
        <L label="Address"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} required /></L>
        <L label="Suburb"><input className="input" value={f.suburb} onChange={(e) => set("suburb", e.target.value)} /></L>
        <L label="Job type"><input className="input" value={f.job_type} onChange={(e) => set("job_type", e.target.value)} required /></L>
        <L label="Quoted hours"><input className="input" inputMode="decimal" value={f.quoted_hours} onChange={(e) => set("quoted_hours", e.target.value)} /></L>
        <L label="Travel zone">
          <select className="input" value={f.travel_zone} onChange={(e) => set("travel_zone", e.target.value as Job["travel_zone"])}>
            {brand.travelZones.map((z) => (
              <option key={z} value={z}>
                {z === "beyond" ? "Beyond zone 3" : `Zone ${z}`}
              </option>
            ))}
          </select>
        </L>
        <L label="Van">
          <select className="input" value={f.van} onChange={(e) => set("van", Number(e.target.value))}>
            {brand.vans.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </L>
      </div>
      <L label="Description"><textarea className="input min-h-24 py-3" value={f.description} onChange={(e) => set("description", e.target.value)} /></L>
      <L label="Access notes"><textarea className="input min-h-20 py-3" value={f.access_notes} onChange={(e) => set("access_notes", e.target.value)} /></L>

      <fieldset>
        <legend className="mb-1 font-semibold">Crew on this job</legend>
        <div className="flex flex-wrap gap-2">
          {crew.map((c) => {
            const on = f.assigned_to.includes(c.id);
            const blocked = f.is_gas && !c.can_do_gas;
            return (
              <label key={c.id} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 ${blocked ? "border-danger/40 bg-danger/5 text-danger" : "border-line"}`}>
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={on}
                  disabled={blocked && !on}
                  onChange={(e) => set("assigned_to", e.target.checked ? [...f.assigned_to, c.id] : f.assigned_to.filter((id) => id !== c.id))}
                />
                {c.name}
                {blocked && <span className="text-xs font-bold">NO GAS</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" className="h-6 w-6" checked={f.is_gas} onChange={(e) => set("is_gas", e.target.checked)} />
        <span className="font-semibold">Gas job (only certified crew can be assigned)</span>
      </label>
      {gasBlocked.length > 0 && (
        <p className="rounded-xl bg-danger/10 p-3 font-semibold text-danger">
          {gasBlocked.map((c) => c.name).join(", ")} can&apos;t be on a gas job. Untick them or turn off Gas job.
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-accent" disabled={gasBlocked.length > 0}>
          Save
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
    </label>
  );
}
