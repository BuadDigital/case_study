import { notFound } from "next/navigation";
import { AppPageView } from "@/components/views/AppPageView";
import { VALID_PAGE_IDS } from "@platform/app-shared/app-data/constants";
import type { PageId } from "@platform/types";

export default async function PrototypePage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: raw } = await params;
  if (!VALID_PAGE_IDS.has(raw as PageId)) notFound();
  return <AppPageView page={raw as PageId} />;
}
