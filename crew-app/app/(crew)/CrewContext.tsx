"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types";

interface Ctx {
  user: AppUser;
  crew: AppUser[];
}

const CrewCtx = createContext<Ctx | null>(null);

/** Who is logged in and who else is on the crew (for "hours per person on site"). */
export function CrewProvider({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const [crew, setCrew] = useState<AppUser[]>(() => {
    if (typeof window === "undefined") return [user];
    try {
      const raw = localStorage.getItem("crew-list");
      if (raw) return JSON.parse(raw) as AppUser[];
    } catch {}
    return [user];
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().from("users").select("id, name, email, role, van, can_do_gas").order("name");
      const list = (data ?? []) as AppUser[];
      if (list.length) {
        setCrew(list);
        try {
          localStorage.setItem("crew-list", JSON.stringify(list));
        } catch {}
      }
    })();
  }, []);

  return <CrewCtx.Provider value={{ user, crew }}>{children}</CrewCtx.Provider>;
}

export function useCrew(): Ctx {
  const v = useContext(CrewCtx);
  if (!v) throw new Error("useCrew outside CrewProvider");
  return v;
}
