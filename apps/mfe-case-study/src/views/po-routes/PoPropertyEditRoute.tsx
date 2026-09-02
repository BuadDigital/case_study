"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PoPropertyEdit } from "@case-study/mfe/components/po-intake/PoPropertyEdit";
import { poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";

export function PoPropertyEditRoute({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <PoPropertyEdit
      poNumber={poNumber}
      propertyId={propertyId}
      onBackAction={() => router.push(poPropertiesPath(poNumber))}
      onSavedAction={() => {
        void queryClient.invalidateQueries({ queryKey: appDataKeys.all });
        router.push(poPropertiesPath(poNumber));
      }}
      onDeletedAction={() => {
        void queryClient.invalidateQueries({ queryKey: appDataKeys.all });
        router.push(poPropertiesPath(poNumber));
      }}
    />
  );
}
