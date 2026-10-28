import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sends each person to their home screen: Mike to the board, crew to Today. */
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login?setup=1");
  redirect(user.role === "admin" ? "/office" : "/today");
}
