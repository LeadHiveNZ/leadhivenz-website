import { brand } from "@/config/brand";
import type { AppUser } from "@/lib/types";

export function UserMenu({ user }: { user: AppUser }) {
  return (
    <details className="relative">
      <summary className="flex h-12 cursor-pointer list-none items-center rounded-xl px-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {user.name}
      </summary>
      <div className="card absolute right-0 mt-2 w-64 p-2 text-ink shadow-xl">
        <div className="px-3 py-2 text-sm text-muted">
          {user.role === "admin" ? "Office" : user.role === "qualified" ? "Qualified" : "Apprentice"}
          {user.van ? ` · ${brand.vans.find((v) => v.id === user.van)?.label ?? `Van ${user.van}`}` : ""}
        </div>
        {user.role === "admin" && (
          <a href="/today" className="block rounded-lg px-3 py-3 font-semibold hover:bg-page">
            Crew view
          </a>
        )}
        <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="block rounded-lg px-3 py-3 font-semibold hover:bg-page">
          Call office {brand.phone}
        </a>
        <form action="/auth/signout" method="post">
          <button className="block w-full rounded-lg px-3 py-3 text-left font-semibold text-danger hover:bg-page" type="submit">
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}
