import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTaskKind } from "@case-study/mfe/lib/prototype/tasks-storage";

/** Party names as in the failures document. */
export const FAILURE_RAISER_LABEL_BY_KIND: Partial<
  Record<WorkflowTaskKind, string>
> = {
  "field-inspection": "المعاين",
  "property-appraisal": "المقيم",
  "engineering-survey": "المكتب الهندسي",
};

export const GOVERNMENT_REVIEWER_FAILURE_RAISER = "المراجع الحكومي";

export function failureRaiserRoleForParty(def: PartyTaskPageDef): string {
  return FAILURE_RAISER_LABEL_BY_KIND[def.kind] ?? def.assigneeSubtitle;
}

export const FAILURE_RAISER_SUPERVISOR = "المشرف";
export const FAILURE_RAISER_SPECIALIST = "الأخصائي";
