"use client";

import { useRef, useState } from "react";
import { Icon } from "../ui/Icon";

type Photo = { id: string; url: string };

type Props = {
  kind: "property" | "report" | "completion" | "quote" | "receipt" | "licence" | "insurance" | "dispute";
  /** The name the photo ids are sent under when the form is submitted. */
  name?: string;
  label: string;
  hint?: string;
  max?: number;
  /** For people who are not signed in: the link they arrived by. */
  token?: string;
  offer?: string;
};

const MAX_EDGE = 1600;

/**
 * Shrinks a phone photo to a sensible size before sending it. A photo straight
 * off a phone is 3 to 10 MB. This makes it about a tenth of that, which sends
 * quickly on a weak signal. Redrawing it also drops the hidden details phones
 * add to photos, such as where it was taken.
 */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Add photos to a form. Each one is sent as soon as it is chosen, so the form itself stays quick to send. */
export function PhotoUploader({ kind, name = "uploadIds", label, hint, max = 6, token, offer }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const suffix = token ? `?t=${encodeURIComponent(token)}` : offer ? `?o=${encodeURIComponent(offer)}` : "";

  async function add(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = max - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(`Up to ${max} photos. The rest were left out.`);
    for (const file of chosen) {
      setBusy((count) => count + 1);
      try {
        const small = await shrink(file);
        const body = new FormData();
        body.set("file", new File([small], "photo.jpg", { type: small.type || file.type }));
        body.set("kind", kind);
        if (token) body.set("token", token);
        if (offer) body.set("offer", offer);
        const response = await fetch("/api/uploads", { method: "POST", body });
        const result = (await response.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
        if (!response.ok || !result.id || !result.url) throw new Error(result.error ?? "That photo could not be added. Please try again.");
        setPhotos((current) => [...current, { id: result.id!, url: result.url! }]);
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "That photo could not be added. Please try again.");
      } finally {
        setBusy((count) => count - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-tint">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private photo served by this site, not a public image to optimise */}
            <img src={`${photo.url}${suffix}`} alt="Photo added" className="h-full w-full object-cover" />
            <input type="hidden" name={name} value={photo.id} />
            <button
              type="button"
              onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-dark/80 text-sm font-bold text-white"
              aria-label="Remove this photo"
            >
              ×
            </button>
          </div>
        ))}
        {busy > 0 && <div className="flex aspect-square animate-pulse items-center justify-center rounded-xl border border-line bg-tint text-sm text-muted">Adding...</div>}
        {photos.length + busy < max && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-white text-sm font-semibold text-brand hover:border-brand hover:bg-tint">
            <Icon name="camera" size={24} />
            Add photo
            <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => void add(event.target.files)} />
          </label>
        )}
      </div>
      {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
