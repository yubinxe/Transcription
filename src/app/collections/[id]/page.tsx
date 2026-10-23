import { CollectionView } from "@/components/collection/CollectionView";

export const metadata = { title: "컬렉션" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionView id={id} />;
}
