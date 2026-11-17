"use client";

import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  appraiserAssignedToProperty,
  editsOnlyAssignedProperties,
} from "../lib/app-data/appraiser-property-access";
import { useWorkflowTasksQuery } from "./case-study-queries";

/**
 * What: whether the viewer's role-based property edit rights hold on this property.
 * How it works: every role but the appraiser answers true, and the role rules (`canEditPropertyData`,
 * `canUploadPropertyDocuments`…) decide. The appraiser answers true only on a transaction assigned to
 * him, read from his own task list.
 * Edge cases: null while his tasks load. Callers treat null as "not yet" (no editing, no refusal note),
 * so nothing editable flashes on another appraiser's property. Added 2026-11-17 with «جميع العقارات»;
 * the server refuses the same writes.
 */
export function useViewerEditsProperty(
  propertyId: string | null | undefined,
  transactionId: string | null | undefined,
): boolean | null {
  const { role } = useAppAccess();
  const limited = editsOnlyAssignedProperties(role);
  const { data: tasks, isFetched } = useWorkflowTasksQuery();
  if (!limited) return true;
  if (!isFetched) return null;
  return appraiserAssignedToProperty(tasks, propertyId, transactionId);
}
