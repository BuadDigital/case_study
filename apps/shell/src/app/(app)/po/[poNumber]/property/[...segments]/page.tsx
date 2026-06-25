import { notFound } from "next/navigation";
import {
  PoPropertyCreateRoute,
  PoPropertyDetailPage,
  PoPropertyEditRoute,
  PoPropertyFailureRoute,
  decodePoParam,
} from "@case-study/mfe";

export default async function PoPropertySegmentsPage({
  params,
}: {
  params: Promise<{ poNumber: string; segments: string[] }>;
}) {
  const { poNumber: rawPo, segments: rawSegments } = await params;
  const poNumber = decodePoParam(rawPo);
  const segments = rawSegments.map(decodePoParam);

  if (segments.length === 1 && segments[0] === "new") {
    return <PoPropertyCreateRoute poNumber={poNumber} />;
  }

  if (segments.length === 1) {
    return (
      <PoPropertyDetailPage poNumber={poNumber} propertyId={segments[0]!} />
    );
  }

  if (segments.length === 2 && segments[1] === "edit") {
    return (
      <PoPropertyEditRoute poNumber={poNumber} propertyId={segments[0]!} />
    );
  }

  if (segments.length === 2 && segments[1] === "failure") {
    return (
      <PoPropertyFailureRoute poNumber={poNumber} propertyId={segments[0]!} />
    );
  }

  notFound();
}
