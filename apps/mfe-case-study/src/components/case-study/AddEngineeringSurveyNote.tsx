"use client";

import { useState } from "react";
import { Button, Note, useToast } from "@platform/ui-kit";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { getEngineeringOffices } from "../../lib/app-data/distribution-parties";
import { addEngineeringSurveyToTask } from "../../lib/app-data/tasks-commands";

/**
 * «يلزم رفع مساحي» — shown to the case specialist when the inspector's corrected type needs a survey
 * nobody was given (2026-10-29). He picks the office and adds it; the study cannot be issued until then.
 * The parent decides when to show it (surveyMissingAfterTypeChange).
 */
export function AddEngineeringSurveyNote({
  caseStudyTaskId,
  newType,
  staffUsers,
}: {
  caseStudyTaskId: string;
  newType: string;
  staffUsers: StaffUser[];
}) {
  const { showToast } = useToast();
  const offices = getEngineeringOffices(staffUsers);
  const [officeId, setOfficeId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const office = offices.find((o) => o.id === officeId);
    if (!office) {
      showToast("اختر المكتب الهندسي", "error");
      return;
    }
    setSaving(true);
    const result = await addEngineeringSurveyToTask(caseStudyTaskId, office);
    setSaving(false);
    showToast(result.ok ? "أُضيف الرفع المساحي وأُبلغ المكتب" : result.error, result.ok ? "success" : "error");
  }

  return (
    <Note tone="warn" className="mb-3">
      <p className="mb-2 text-sm">
        غيّر المعاين نوع العقار إلى «{newType}» — النوع الجديد يحتاج رفعاً مساحياً ولم يُوزَّع مكتب هندسي.
        أضف المكتب؛ لا يُصدر تقرير دراسة الحالة قبل ذلك.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <RegSelect
            id="add_survey_office"
            label="المكتب الهندسي"
            required
            options={offices.map((o) => ({ value: o.id, label: o.subtitle ? `${o.name} — ${o.subtitle}` : o.name }))}
            value={officeId}
            placeholder="اختر المكتب…"
            onChange={setOfficeId}
          />
        </div>
        <Button type="button" disabled={saving || !officeId} onClick={() => void add()}>
          إضافة رفع مساحي
        </Button>
      </div>
    </Note>
  );
}
