"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Note,
  PageGutter,
  PanelSkeleton,
  QueryErrorState,
} from "@platform/ui-kit";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import {
  poListPath,
  poPropertiesPath,
} from "@platform/app-shared/domain/po-routes";
import type {
  PoIntakeRecord,
  PoPropertyIntake,
} from "../lib/app-data/po-intake-data";
import { usePoRecordQuery } from "../query/case-study-queries";

function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
      {children}
    </div>
  );
}

function NotFound({
  line,
  back,
  label,
}: {
  line: string;
  back: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <GateFrame>
      <PageGutter className="py-6">
        <Note tone="warn">
          {line}
          <div className="mt-3">
            <Button
              size="sm"
              variant="default"
              type="button"
              onClick={() => router.push(back)}
            >
              {label}
            </Button>
          </div>
        </Note>
      </PageGutter>
    </GateFrame>
  );
}

/**
 * Loads a property page's work order and deed, and renders the page only once both are there.
 *
 * How it works: a skeleton while the work order loads; a failed load is not «not found» — it says so
 * with a retry; a missing work order or deed says which, with the way back.
 * Edge cases: extracted 2026-11-05 from the property details page so the work page loads the same way.
 */
export function PoPropertyRouteGate({
  poNumber,
  propertyId,
  children,
}: {
  poNumber: string;
  propertyId: string;
  children: (loaded: {
    record: PoIntakeRecord;
    property: PoPropertyIntake;
    index: number;
  }) => ReactNode;
}) {
  const recordQuery = usePoRecordQuery(poNumber);
  const { data: record, isPending } = recordQuery;
  const index = record
    ? record.properties.findIndex((p) => p.id === propertyId)
    : -1;

  if (isPending && !record) {
    return (
      <GateFrame>
        <PanelSkeleton />
      </GateFrame>
    );
  }
  if (!record && queryLoadFailed(recordQuery)) {
    return (
      <GateFrame>
        <PageGutter className="py-6">
          <QueryErrorState
            panel
            line="تعذّر تحميل أمر العمل"
            error={recordQuery.error}
            onRetry={() => void recordQuery.refetch()}
            retrying={recordQuery.isFetching}
          />
        </PageGutter>
      </GateFrame>
    );
  }
  if (!record) {
    return (
      <NotFound
        line="لم يُعثر على أمر العمل."
        back={poListPath()}
        label="رجوع لأوامر العمل"
      />
    );
  }
  if (index < 0) {
    return (
      <NotFound
        line="لم يُعثر على العقار."
        back={poPropertiesPath(poNumber)}
        label="رجوع لعقارات الأمر"
      />
    );
  }
  return (
    <>{children({ record, property: record.properties[index]!, index })}</>
  );
}
