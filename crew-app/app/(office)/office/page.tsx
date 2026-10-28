import { Board } from "./Board";

export const metadata = { title: "Board" };

export default async function OfficePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  return <Board initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null} />;
}
