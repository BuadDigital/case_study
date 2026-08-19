"use client";

import { NABR_SEED_CLIENT_ID } from "@platform/api-client";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  showsValuationReportUserField,
  VALUATION_REPORT_USER_OPTION_LABEL,
  type AssignmentType,
} from "../../lib/prototype/po-intake-data";

export function ValuationReportUserField({
  assignmentType,
  clientId,
  id,
}: {
  assignmentType: AssignmentType | "";
  clientId: string;
  id: string;
}) {
  if (!showsValuationReportUserField(assignmentType, clientId)) return null;

  return (
    <RegSelect
      id={id}
      label="مستخدم تقرير التقييم"
      required
      value={NABR_SEED_CLIENT_ID}
      options={[
        {
          value: NABR_SEED_CLIENT_ID,
          label: VALUATION_REPORT_USER_OPTION_LABEL,
        },
      ]}
      onChange={() => undefined}
    />
  );
}
