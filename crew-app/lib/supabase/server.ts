import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AppUser } from "@/lib/types";

/** Server-side Supabase client for server components, route handlers and server actions. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component: cookies are read-only there. proxy.ts refreshes them.
          }
        },
      },
    },
  );
}

/** The logged-in user's profile row, or null when not logged in / not set up. */
export async function currentUser(): Promise<AppUser | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("id, name, email, role, van, can_do_gas")
    .eq("id", user.id)
    .maybeSingle();
  return (data as AppUser | null) ?? null;
}
