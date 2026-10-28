import { redirect } from "next/navigation";
import { PendingBadge } from "@/components/PendingBadge";
import { currentUser } from "@/lib/supabase/server";
import { CrewProvider } from "./CrewContext";

export const dynamic = "force-dynamic";

export default async function CrewLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?setup=1");
  return (
    <CrewProvider user={user}>
      {children}
      <PendingBadge />
    </CrewProvider>
  );
}
