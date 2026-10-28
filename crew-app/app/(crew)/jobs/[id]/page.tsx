import { JobScreen } from "./JobScreen";

export const metadata = { title: "Job" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobScreen jobId={id} />;
}
