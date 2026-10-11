"use client";

import { useRouter } from "next/navigation";
import {
  Button,
  Note,
  PageGutter,
  PageShell,
  PanelSkeleton,
  QueryErrorState,
} from "@platform/ui-kit";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { PoDetailPropertyCard } from "@case-study/mfe/components/po-intake/PoDetailPropertyCard";
import { PropertyDetailHero } from "@case-study/mfe/components/po-intake/PropertyDetailHero";
import {
  requiresAssignmentDecree,
} from "../lib/app-data/po-intake-data";
import { poListPath, poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";

export function PoPropertyDetailPage({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  const router = useRouter();
  const recordQuery = usePoRecordQuery(poNumber);
  const { data: record, isPending } = recordQuery;
  const property =
    record?.properties.find((p) => p.id === propertyId) ?? null;
  const index =
    record && property
      ? record.properties.findIndex((p) => p.id === propertyId)
      : -1;

  if (isPending && !record) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PanelSkeleton />
      </div>
    );
  }

  // A failed load is not «not found» — say so and offer a retry.
  if (!record && queryLoadFailed(recordQuery)) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PageGutter className="py-6">
          <QueryErrorState
            panel
            line="تعذّر تحميل أمر العمل"
            error={recordQuery.error}
            onRetry={() => void recordQuery.refetch()}
            retrying={recordQuery.isFetching}
          />
        </PageGutter>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PageGutter className="py-6">
          <Note tone="warn">
            لم يُعثر على أمر العمل.
            <div className="mt-3">
              <Button
                size="sm"
                variant="default"
                type="button"
                onClick={() => router.push(poListPath())}
              >
                رجوع لأوامر العمل
              </Button>
            </div>
          </Note>
        </PageGutter>
      </div>
    );
  }

  const showDecree = requiresAssignmentDecree(record.assignmentType);

  if (!property || index < 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PageGutter className="py-6">
          <Note tone="warn">
            لم يُعثر على العقار.
            <div className="mt-3">
              <Button
                size="sm"
                variant="default"
                type="button"
                onClick={() => router.push(poPropertiesPath(poNumber))}
              >
                رجوع لعقارات الأمر
              </Button>
            </div>
          </Note>
        </PageGutter>
      </div>
    );
  }

  return (
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

        <PoDetailPropertyCard
          layout="page"
          index={index + 1}
          property={property}
          poNumber={record.poNumber}
          assignmentType={record.assignmentType}
          showDecree={showDecree}
          record={record}
        />
      </PageShell>
    </div>
  );
}
