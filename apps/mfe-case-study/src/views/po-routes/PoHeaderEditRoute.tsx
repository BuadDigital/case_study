"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Note, PanelSkeleton } from "@platform/design-system";
import { PoHeaderEdit } from "@case-study/mfe/components/po-intake/PoHeaderEdit";
import { poListPath } from "../../lib/po-routes";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";

export function PoHeaderEditRoute({ poNumber }: { poNumber: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: record, isPending } = usePoRecordQuery(poNumber);

  if (isPending && !record) {
    return (
      <PanelSkeleton className="m-4" />
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
      onBackAction={() => router.push(poListPath())}
      onSavedAction={() => {
        void queryClient.invalidateQueries({ queryKey: prototypeKeys.all });
        router.push(poListPath());
      }}
    />
  );
}
