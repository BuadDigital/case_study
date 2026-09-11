"use client";

/**
 * Everything behind the governed «مستندات العقار» checklist: the per-source documents the
 * page already collects, the documents-tab uploads, the admin type settings, role gates and
 * the upload / classify / review commands. The tab component keeps JSX only.
 */

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { PropertyDetailDocumentSection } from "../../lib/app-data/property-detail-documents";
import {
  canReviewUnlistedDocuments,
  canUploadPropertyDocuments,
} from "../../lib/app-data/po-roles";
import {
  buildPropertyDocumentChecklist,
  propertyDocumentUploadOptions,
} from "../../lib/app-data/property-document-checklist";
import {
  deleteGovernedPropertyDocument,
  reclassifyGovernedPropertyDocument,
  reviewUnlistedPropertyDocument,
  uploadGovernedPropertyDocument,
  type GovernedDocumentCommandResult,
  type GovernedDocumentTypeInput,
} from "../../lib/app-data/governed-property-documents-commands";
import {
  governedPropertyDocumentsQueryKey,
  useGovernedPropertyDocumentsQuery,
} from "../../query/governed-property-documents-query";

export function usePropertyDocumentsWorkflow({
  sections,
  property,
  poNumber,
}: {
  sections: PropertyDetailDocumentSection[];
  property: PoPropertyIntake;
  poNumber: string;
}) {
  const { role } = useAppAccess();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const lists = useValuationListsQuery();
  const governed = useGovernedPropertyDocumentsQuery({
    poNumber,
    propertyId: property.id,
  });
  const [busy, setBusy] = useState(false);

  // After field inspection the inspector-confirmed type wins operationally.
  const propertyType =
    property.effectivePropertyType?.trim() ||
    property.inspectedPropertyType?.trim() ||
    property.propertyType.trim();
  const attachmentsList = lists.data?.lists?.attachments ?? null;

  const checklist = useMemo(
    () =>
      buildPropertyDocumentChecklist({
        entries: [
          ...sections.flatMap((section) => section.documents),
          ...(governed.data ?? []),
        ],
        attachmentsList,
        propertyType,
      }),
    [sections, governed.data, attachmentsList, propertyType],
  );
  const uploadOptions = useMemo(
    () => propertyDocumentUploadOptions(attachmentsList),
    [attachmentsList],
  );

  async function run(
    action: () => Promise<GovernedDocumentCommandResult>,
    successMessage: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        showToast(result.error, "error");
        return false;
      }
      await queryClient.invalidateQueries({
        queryKey: governedPropertyDocumentsQueryKey(poNumber, property.id),
      });
      showToast(successMessage, "success");
      return true;
    } finally {
      setBusy(false);
    }
  }

  return {
    checklist,
    uploadOptions,
    propertyType,
    canUpload: canUploadPropertyDocuments(role),
    canReview: canReviewUnlistedDocuments(role),
    busy,
    loadFailed: governed.isError,
    upload: (input: GovernedDocumentTypeInput & { file: File }) =>
      run(
        () =>
          uploadGovernedPropertyDocument({
            ...input,
            poNumber,
            propertyId: property.id,
          }),
        "تم رفع المستند",
      ),
    reclassify: (attachmentId: string, input: GovernedDocumentTypeInput) =>
      run(
        () => reclassifyGovernedPropertyDocument(attachmentId, input),
        "تم تصنيف المستند",
      ),
    approve: (attachmentId: string) =>
      run(
        () => reviewUnlistedPropertyDocument(attachmentId, "approved"),
        "تم اعتماد المستند",
      ),
    reject: (attachmentId: string, note: string) =>
      run(
        () => reviewUnlistedPropertyDocument(attachmentId, "rejected", note),
        "تم رفض المستند",
      ),
    remove: (attachmentId: string) =>
      run(() => deleteGovernedPropertyDocument(attachmentId), "تم حذف المستند"),
  };
}
