import { notFound } from "next/navigation";
import { PrototypePageView } from "@/components/views/PrototypePageView";
import { VALID_PAGE_IDS } from "@platform/app-shared/prototype/constants";
import type { PageId } from "@platform/types";

export default async function PrototypePage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: raw } = await params;
  if (!VALID_PAGE_IDS.has(raw as PageId)) notFound();
  return <PrototypePageView page={raw as PageId} />;
}
