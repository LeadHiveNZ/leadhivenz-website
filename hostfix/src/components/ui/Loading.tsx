/** Shown for a moment while a signed-in page loads. */
export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4 py-2">
      <span className="sr-only">{label}</span>
      <div className="h-9 w-2/3 rounded-xl bg-line/70" />
      <div className="h-24 rounded-2xl bg-line/50" />
      <div className="h-24 rounded-2xl bg-line/50" />
      <div className="h-24 rounded-2xl bg-line/40" />
    </div>
  );
}
