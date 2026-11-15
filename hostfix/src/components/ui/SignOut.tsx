import { signOutUser } from "@/app/actions/auth";
import { Icon } from "./Icon";

/** The sign-out button. In the top bar it is just an icon on a phone; pass `full` to always show the words. */
export function SignOut({ label = "Sign out", full }: { label?: string; full?: boolean }) {
  return (
    <form action={signOutUser}>
      <button
        type="submit"
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-tint hover:text-ink ${full ? "border border-line bg-surface" : ""}`}
      >
        <Icon name="out" size={18} />
        {full ? (
          <span>{label}</span>
        ) : (
          <>
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </>
        )}
      </button>
    </form>
  );
}
