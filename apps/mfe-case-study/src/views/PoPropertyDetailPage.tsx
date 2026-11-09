"use client";

import { PageShell } from "@platform/ui-kit";
import { PoDetailPropertyCard } from "@case-study/mfe/components/po-intake/PoDetailPropertyCard";
import { PropertyDetailHero } from "@case-study/mfe/components/po-intake/PropertyDetailHero";
import { TransactionCancellationBanner } from "@case-study/mfe/components/po-intake/TransactionCancellationBanner";
import { requiresAssignmentDecree } from "../lib/app-data/po-intake-data";
import { PoPropertyRouteGate } from "./PoPropertyRouteGate";

export function PoPropertyDetailPage({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  return (
    <PoPropertyRouteGate poNumber={poNumber} propertyId={propertyId}>
      {({ record, property, index }) => (
        <div
          id="view-property"
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg [zoom:0.85]"
        >
          <PageShell
            variant="canvas"
            className="gap-0 overflow-y-auto bg-bg px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
          >
            <PropertyDetailHero
              record={record}
              property={property}
              propertyIndex={index + 1}
            />

            <TransactionCancellationBanner propertyId={property.id} />

            <PoDetailPropertyCard
              layout="page"
              index={index + 1}
              property={property}
              poNumber={record.poNumber}
              assignmentType={record.assignmentType}
              showDecree={requiresAssignmentDecree(record.assignmentType)}
              record={record}
            />
          </PageShell>
        </div>
      )}
    </PoPropertyRouteGate>
  );
}
