import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { PoPropertiesPageClient } from "@/components/po/PoPropertiesPageClient";
import { PoHeaderEditRoute } from "@case-study/mfe/views/po-routes/PoHeaderEditRoute";
import { PoPropertyDetailPage } from "@case-study/mfe/views/PoPropertyDetailPage";
import { PoPropertyEditRoute } from "@case-study/mfe/views/po-routes/PoPropertyEditRoute";
import { PoPropertyWorkPage } from "@case-study/mfe/views/PoPropertyWorkPage";
import { PoPropertyFailureRoute } from "@case-study/mfe/views/po-routes/PoPropertyFailureRoute";
import { PoTaskCoordinationRoute } from "@case-study/mfe/views/po-routes/PoTaskCoordinationRoute";
import { PoPropertyCoordinationPage } from "@case-study/mfe/views/PoPropertyCoordinationPage";
import { PO_PROPERTY_SEGMENT, decodePoParam } from "@platform/app-shared/domain/po-routes";

function normalizeSegments(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map(decodePoParam);
}

/**
 * The pages under one deed — `/po/{po}/property/{id}/{page}`: edit, the work page, the coordinator's
 * page (Omar 2026-11-08) and the failure page. One table so a new page is one line.
 */
const PROPERTY_PAGES: Record<string, ComponentType<{ poNumber: string; propertyId: string }>> = {
  edit: PoPropertyEditRoute,
  work: PoPropertyWorkPage,
  coordination: PoPropertyCoordinationPage,
  failure: PoPropertyFailureRoute,
};

export default async function PoNestedRoutePage({
  params,
}: {
  params: Promise<{ segments: string | string[] }>;
}) {
  const { segments: rawSegments } = await params;
  const segments = normalizeSegments(rawSegments);
  const [poNumber, section, id, page] = segments;

  if (segments.length === 2 && section === "edit") {
    return <PoHeaderEditRoute poNumber={poNumber!} />;
  }

  if (segments.length === 2 && section === PO_PROPERTY_SEGMENT) {
    return <PoPropertiesPageClient poNumber={poNumber!} />;
  }

  if (segments.length === 3 && section === PO_PROPERTY_SEGMENT && id === "new") {
    notFound();
  }

  if (segments.length === 3 && section === PO_PROPERTY_SEGMENT) {
    return <PoPropertyDetailPage poNumber={poNumber!} propertyId={id!} />;
  }

  // A deed's task that may have no property yet opens the coordinator's page (it creates the draft).
  if (segments.length === 4 && section === "task" && page === "coordination") {
    return <PoTaskCoordinationRoute poNumber={poNumber!} taskId={id!} />;
  }

  const PropertyPage = segments.length === 4 && section === PO_PROPERTY_SEGMENT ? PROPERTY_PAGES[page!] : undefined;
  if (PropertyPage) {
    return <PropertyPage poNumber={poNumber!} propertyId={id!} />;
  }

  notFound();
}
