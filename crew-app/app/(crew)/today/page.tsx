import { TodayScreen } from "./TodayScreen";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  return <TodayScreen initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null} />;
}
