import { notFound } from "next/navigation";
import { PoPropertiesPageClient } from "@/components/po/PoPropertiesPageClient";
import {
  PoHeaderEditRoute,
  PoPropertyCreateRoute,
  PoPropertyDetailPage,
  PoPropertyEditRoute,
  PoPropertyFailureRoute,
  PO_PROPERTY_SEGMENT,
  decodePoParam,
} from "@case-study/mfe";

function normalizeSegments(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map(decodePoParam);
}

export default async function PoNestedRoutePage({
  params,
}: {
  params: Promise<{ segments: string | string[] }>;
}) {
  const { segments: rawSegments } = await params;
  const segments = normalizeSegments(rawSegments);

  if (segments.length === 2 && segments[1] === "edit") {
    return <PoHeaderEditRoute poNumber={segments[0]!} />;
  }

  if (
    segments.length === 2 &&
    segments[1] === PO_PROPERTY_SEGMENT
  ) {
    return <PoPropertiesPageClient poNumber={segments[0]!} />;
  }

  if (
    segments.length === 3 &&
    segments[1] === PO_PROPERTY_SEGMENT &&
    segments[2] === "new"
  ) {
    return <PoPropertyCreateRoute poNumber={segments[0]!} />;
  }

  if (segments.length === 3 && segments[1] === PO_PROPERTY_SEGMENT) {
    return (
      <PoPropertyDetailPage
        poNumber={segments[0]!}
        propertyId={segments[2]!}
      />
    );
  }

  if (
    segments.length === 4 &&
    segments[1] === PO_PROPERTY_SEGMENT &&
    segments[3] === "edit"
  ) {
    return (
      <PoPropertyEditRoute
        poNumber={segments[0]!}
        propertyId={segments[2]!}
      />
    );
  }

  if (
    segments.length === 4 &&
    segments[1] === PO_PROPERTY_SEGMENT &&
    segments[3] === "failure"
  ) {
    return (
      <PoPropertyFailureRoute
        poNumber={segments[0]!}
        propertyId={segments[2]!}
      />
    );
  }

  notFound();
}
