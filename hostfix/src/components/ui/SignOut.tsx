import { signOutUser } from "@/app/actions/auth";
import { Icon } from "./Icon";

/** The sign-out button in the top bar. */
export function SignOut({ label = "Sign out" }: { label?: string }) {
  return (
    <form action={signOutUser}>
      <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-tint hover:text-ink">
        <Icon name="out" size={18} />
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </button>
    </form>
  );
}
