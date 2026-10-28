"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import { StatusChip } from "@/components/StatusChip";
import { TopBar } from "@/components/TopBar";
import { loadJob, photoUrl } from "@/lib/data";
import { enqueue, getBlob, newId, onOutboxChange, putBlob } from "@/lib/offline/db";
import { flushOutbox, onSyncDone } from "@/lib/offline/sync";
import { compressImage } from "@/lib/photos";
import { fmtHours, fmtTime, rateBandFor } from "@/lib/time";
import { NEXT_ACTION_LABEL, nextStatus, type JobBundle, type PhotoKind } from "@/lib/types";
import { useCrew } from "../../CrewContext";

export function JobScreen({ jobId }: { jobId: string }) {
  const { user, crew } = useCrew();
  const router = useRouter();
  const [bundle, setBundle] = useState<JobBundle | null | undefined>(undefined);
  const [fromCache, setFromCache] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "hours" | "materials" | "note" | "done">(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoKind, setPhotoKind] = useState<PhotoKind>("before");

  const load = useCallback(async () => {
    const r = await loadJob(jobId);
    setBundle(r.data);
    setFromCache(r.fromCache);
  }, [jobId]);

  useEffect(() => {
    void load();
    const off1 = onSyncDone(() => void load());
    const off2 = onOutboxChange(() => void load());
    return () => {
      off1();
      off2();
    };
  }, [load]);

  if (bundle === undefined) {
    return (
      <div>
        <TopBar back="/today" title="Job" />
        <p className="py-10 text-center text-muted">Loading…</p>
      </div>
    );
  }
  if (bundle === null) {
    return (
      <div>
        <TopBar back="/today" title="Job" />
        <div className="card m-3 p-6 text-center">
          <p className="text-xl font-semibold">This job isn&apos;t saved on your phone.</p>
          <p className="mt-1 text-muted">Open it once while you have signal and it will be here next time.</p>
        </div>
      </div>
    );
  }

  const { job } = bundle;
  const peopleOnJob = crew.filter((c) => job.assigned_to.includes(c.id) || c.id === user.id);
  const canChange = user.role === "admin" || job.van === user.van;
  const next = nextStatus(job.status);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${job.address}${job.suburb ? ", " + job.suburb : ""}, ${brand.city}`)}`;
  const totalMinutes = bundle.time.reduce((s, t) => s + t.minutes, 0);

  async function advance() {
    if (!next || busy) return;
    if (next === "done") {
      setSheet("done");
      return;
    }
    setBusy(true);
    await enqueue({ kind: "set_status", job_id: job.id, status: next, at: new Date().toISOString() });
    void flushOutbox();
    setBusy(false);
  }

  async function markDone() {
    setBusy(true);
    await enqueue({ kind: "set_status", job_id: job.id, status: "done", at: new Date().toISOString() });
    void flushOutbox();
    setBusy(false);
    setSheet(null);
    router.push("/today");
  }

  async function undoStatus() {
    const order = ["scheduled", "on_the_way", "on_site", "done"] as const;
    const i = order.indexOf(job.status);
    if (i <= 0) return;
    await enqueue({ kind: "set_status", job_id: job.id, status: order[i - 1], at: new Date().toISOString() });
    void flushOutbox();
  }

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    for (const f of files) {
      const blob = await compressImage(f);
      const id = newId();
      const key = `photo-${id}`;
      await putBlob(key, blob);
      await enqueue({ kind: "add_photo", id, job_id: job.id, photo_kind: photoKind, taken_by: user.id, taken_at: new Date().toISOString(), blob_key: key });
    }
    void flushOutbox();
    setBusy(false);
  }

  async function addTime(userId: string, minutes: number) {
    const now = new Date();
    await enqueue({ kind: "add_time", id: newId(), job_id: job.id, user_id: userId, minutes, started_at: now.toISOString(), rate_band: rateBandFor(new Date(job.start_at)) });
    void flushOutbox();
  }

  async function addMaterial(description: string, qty: number) {
    await enqueue({ kind: "add_material", id: newId(), job_id: job.id, description, qty, added_by: user.id });
    void flushOutbox();
  }

  async function addNote(text: string) {
    await enqueue({ kind: "add_note", id: newId(), job_id: job.id, user_id: user.id, text, created_at: new Date().toISOString() });
    void flushOutbox();
  }

  return (
    <div className="min-h-dvh pb-40">
      <TopBar back="/today" title={job.customer_first_name} right={<StatusChip status={job.status} />} />
      <main className="mx-auto max-w-2xl space-y-3 px-3 pt-3">
        {fromCache && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Saved copy — changes will upload when you have signal.</p>}

        {/* Where and who */}
        <section className="card p-4">
          <p className="text-lg font-bold">
            {fmtTime(job.start_at)} – {fmtTime(job.end_at)}
            {job.quoted_hours != null && <span className="ml-2 font-normal text-muted">· quoted {job.quoted_hours} h</span>}
          </p>
          <h2 className="mt-1 text-2xl">
            {job.job_type}
            {job.is_gas && <span className="ml-2 rounded bg-accent/15 px-2 py-0.5 align-middle text-base text-accent">GAS</span>}
          </h2>
          <a href={mapsUrl} target="_blank" rel="noopener" className="btn btn-outline mt-3 justify-between">
            <span className="truncate text-left">
              {job.address}
              {job.suburb && `, ${job.suburb}`}
            </span>
            <span className="shrink-0 text-base font-bold">Directions ›</span>
          </a>
          {job.customer_phone && (
            <a href={`tel:${job.customer_phone.replace(/\s/g, "")}`} className="btn btn-outline mt-2 justify-between">
              <span>{job.customer_phone}</span>
              <span className="text-base font-bold">Call ›</span>
            </a>
          )}
        </section>

        {job.access_notes && (
          <section className="card border-accent/40 bg-accent/5 p-4">
            <h3 className="text-lg">Access</h3>
            <p className="mt-1 whitespace-pre-wrap text-lg">{job.access_notes}</p>
          </section>
        )}

        {job.description && job.description !== job.job_type && (
          <section className="card p-4">
            <h3 className="text-lg">Job</h3>
            <p className="mt-1 whitespace-pre-wrap">{job.description}</p>
          </section>
        )}

        {/* Photos */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg">Photos ({bundle.photos.length})</h3>
            <select className="input min-h-11 w-auto py-1 text-base" value={photoKind} onChange={(e) => setPhotoKind(e.target.value as PhotoKind)} aria-label="Photo type">
              <option value="before">Before</option>
              <option value="after">After</option>
              <option value="issue">Issue</option>
            </select>
          </div>
          {bundle.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {bundle.photos.map((p) => (
                <PhotoThumb key={p.id} path={p.storage_path} kind={p.kind} />
              ))}
            </div>
          )}
          {canChange && (
            <>
              <input ref={fileInput} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onPhotos} />
              <button className="btn btn-primary mt-3" onClick={() => fileInput.current?.click()} disabled={busy}>
                {busy ? "Saving…" : `Add ${photoKind} photos`}
              </button>
            </>
          )}
        </section>

        {/* Hours */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg">Hours</h3>
            <span className="text-lg font-bold">{totalMinutes > 0 ? fmtHours(totalMinutes) : "—"}</span>
          </div>
          {bundle.time.length > 0 && (
            <ul className="mt-2 space-y-1 text-muted">
              {peopleOnJob.map((p) => {
                const mins = bundle.time.filter((t) => t.user_id === p.id).reduce((s, t) => s + t.minutes, 0);
                return mins > 0 ? (
                  <li key={p.id}>
                    {p.name}: {fmtHours(mins)}
                  </li>
                ) : null;
              })}
            </ul>
          )}
          {canChange && (
            <button className="btn btn-outline mt-3" onClick={() => setSheet("hours")}>
              Add hours
            </button>
          )}
        </section>

        {/* Materials */}
        <section className="card p-4">
          <h3 className="text-lg">Materials used ({bundle.materials.length})</h3>
          {bundle.materials.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bundle.materials.map((m) => (
                <li key={m.id}>
                  {m.qty} × {m.description}
                </li>
              ))}
            </ul>
          )}
          {canChange && (
            <button className="btn btn-outline mt-3" onClick={() => setSheet("materials")}>
              Add materials
            </button>
          )}
        </section>

        {/* Notes */}
        <section className="card p-4">
          <h3 className="text-lg">Notes ({bundle.notes.length})</h3>
          {bundle.notes.length > 0 && (
            <ul className="mt-2 space-y-2">
              {bundle.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-page p-3">
                  <p className="whitespace-pre-wrap">{n.text}</p>
                  <p className="mt-1 text-sm text-muted">
                    {crew.find((c) => c.id === n.user_id)?.name ?? "Crew"} · {fmtTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canChange && (
            <button className="btn btn-outline mt-3" onClick={() => setSheet("note")}>
              Add a note
            </button>
          )}
        </section>

        {job.status !== "scheduled" && canChange && (
          <button className="btn btn-ghost text-base" onClick={undoStatus}>
            Undo last status change
          </button>
        )}
      </main>

      {/* The one big status button */}
      {canChange && next && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-page/95 p-3 backdrop-blur" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <div className="mx-auto max-w-2xl">
            <button className={`btn ${next === "done" ? "btn-success" : "btn-accent"} min-h-16 text-2xl`} onClick={advance} disabled={busy}>
              {NEXT_ACTION_LABEL[job.status]}
            </button>
          </div>
        </div>
      )}

      {sheet === "hours" && (
        <Sheet title="Add hours" onClose={() => setSheet(null)}>
          {peopleOnJob.map((p) => {
            const mins = bundle.time.filter((t) => t.user_id === p.id).reduce((s, t) => s + t.minutes, 0);
            return (
              <div key={p.id} className="mb-3 rounded-xl bg-page p-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{p.name}</span>
                  <span className="text-lg">{mins > 0 ? fmtHours(mins) : "—"}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="btn btn-outline" onClick={() => addTime(p.id, brand.timeBlockMinutes)}>
                    +{brand.timeBlockMinutes} min
                  </button>
                  <button className="btn btn-primary" onClick={() => addTime(p.id, 60)}>
                    +1 h
                  </button>
                </div>
              </div>
            );
          })}
          <button className="btn btn-accent" onClick={() => setSheet(null)}>
            Done
          </button>
        </Sheet>
      )}

      {sheet === "materials" && (
        <Sheet title="Add materials" onClose={() => setSheet(null)}>
          <MaterialForm onAdd={addMaterial} onClose={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === "note" && (
        <Sheet title="Add a note" onClose={() => setSheet(null)}>
          <NoteForm onAdd={addNote} onClose={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === "done" && (
        <Sheet title="Finish this job?" onClose={() => setSheet(null)}>
          <ul className="mb-4 space-y-1 text-lg">
            <li>{bundle.photos.length} photo{bundle.photos.length === 1 ? "" : "s"}</li>
            <li>{totalMinutes > 0 ? fmtHours(totalMinutes) : "No hours"} logged</li>
            <li>{bundle.materials.length} material line{bundle.materials.length === 1 ? "" : "s"}</li>
          </ul>
          {(bundle.photos.length === 0 || totalMinutes === 0) && <p className="mb-4 rounded-xl bg-danger/10 p-3 font-semibold text-danger">Missing {bundle.photos.length === 0 ? "photos" : ""}{bundle.photos.length === 0 && totalMinutes === 0 ? " and " : ""}{totalMinutes === 0 ? "hours" : ""}. You can still finish, but the office will chase you.</p>}
          <button className="btn btn-success min-h-16 text-2xl" onClick={markDone} disabled={busy}>
            Done
          </button>
          <button className="btn btn-ghost mt-2" onClick={() => setSheet(null)}>
            Not yet
          </button>
        </Sheet>
      )}
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-surface p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-2xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function MaterialForm({ onAdd, onClose }: { onAdd: (d: string, q: number) => Promise<void>; onClose: () => void }) {
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState(1);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!desc.trim()) return;
        await onAdd(desc.trim(), qty);
        setDesc("");
        setQty(1);
      }}
      className="space-y-3"
    >
      <input className="input" placeholder="e.g. 15mm elbow" value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus />
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-outline w-16" onClick={() => setQty((q) => Math.max(1, q - 1))}>
          −
        </button>
        <span className="w-16 text-center text-2xl font-bold">{qty}</span>
        <button type="button" className="btn btn-outline w-16" onClick={() => setQty((q) => q + 1)}>
          +
        </button>
        <button type="submit" className="btn btn-primary flex-1">
          Add
        </button>
      </div>
      <button type="button" className="btn btn-accent" onClick={onClose}>
        Done
      </button>
    </form>
  );
}

function NoteForm({ onAdd, onClose }: { onAdd: (t: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        await onAdd(text.trim());
        onClose();
      }}
      className="space-y-3"
    >
      <textarea className="input min-h-32 py-3" placeholder="What the office needs to know" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <button type="submit" className="btn btn-accent">
        Save note
      </button>
    </form>
  );
}

function PhotoThumb({ path, kind }: { path: string; kind: PhotoKind }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    photoUrl(path, getBlob).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <a href={url ?? undefined} target="_blank" rel="noopener" className="relative block aspect-square overflow-hidden rounded-lg bg-page">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={kind} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-sm text-muted">{path.startsWith("local:") ? "Saved" : "…"}</span>
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs font-bold uppercase text-white">{kind}</span>
    </a>
  );
}
