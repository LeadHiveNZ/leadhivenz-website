import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { CrewProvider } from "../(crew)/CrewContext";

export const dynamic = "force-dynamic";

/** Office screens are for admins only. Crew who land here go back to Today. */
export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?setup=1");
  if (user.role !== "admin") redirect("/today");
  return <CrewProvider user={user}>{children}</CrewProvider>;
}
