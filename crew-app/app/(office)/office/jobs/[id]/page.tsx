import { OfficeJob } from "./OfficeJob";

export const metadata = { title: "Job detail" };

export default async function OfficeJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfficeJob jobId={id} />;
}
