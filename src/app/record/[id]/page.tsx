import { RecordWorkspace } from "@/components/record/RecordWorkspace";

export const metadata = { title: "기록" };

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordWorkspace id={id} />;
}
