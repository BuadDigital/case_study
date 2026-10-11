"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Note, PanelSkeleton, QueryErrorState } from "@platform/ui-kit";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { PoHeaderEdit } from "@case-study/mfe/components/po-intake/PoHeaderEdit";
import { poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";

export function PoHeaderEditRoute({ poNumber }: { poNumber: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recordQuery = usePoRecordQuery(poNumber);
  const { data: record, isPending } = recordQuery;

  if (isPending && !record) {
    return (
      <PanelSkeleton className="m-4" />
    );
  }

  if (!record && queryLoadFailed(recordQuery)) {
    return (
      <QueryErrorState
        className="m-4"
        line="تعذّر تحميل أمر العمل"
        error={recordQuery.error}
        onRetry={() => void recordQuery.refetch()}
        retrying={recordQuery.isFetching}
      />
    );
  }

  if (!record) {
    return (
      <Note tone="warn" className="m-4">
        لم يُعثر على أمر العمل.
      </Note>
    );
  }

  return (
    <PoHeaderEdit
      record={record}
      onBackAction={() => router.push(poPropertiesPath(poNumber))}
      onSavedAction={() => {
        void queryClient.invalidateQueries({ queryKey: appDataKeys.all });
        router.push(poPropertiesPath(poNumber));
      }}
    />
  );
}
