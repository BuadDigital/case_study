"use client";

import { InlineLoadingSkeleton } from "@platform/design-system";
import { EmptyState } from "./PropertyDetailFields";
import {
  EngineeringPartyNotesSection,
  type PartyNoteRow,
} from "../fees/EngineeringPartyNotesSection";

export type PartyRemarksSection = {
  id: string;
  title: string;
  remarks: PartyNoteRow[];
};

/**
 * Read-only notes board: remarks from engineering office, field inspector,
 * and appraiser (no compose / chat UI).
 */
export function PropertyDetailSurveyNotesTab({
  sections,
  loading,
}: {
  sections: PartyRemarksSection[];
  loading: boolean;
  /** @deprecated unused — remarks are read-only from party submissions */
  remarks?: PartyNoteRow[];
  poNumber?: string;
  propertyId?: string;
  authorName?: string;
}) {
  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  const filled = sections
    .map((section) => ({
      ...section,
      remarks: section.remarks.filter((row) => row.value.trim()),
    }))
    .filter((section) => section.remarks.length > 0);

  if (filled.length === 0) {
    return (
      <EmptyState
        title="لا توجد ملاحظات من الأطراف بعد"
        sub="تظهر هنا ملاحظات المكتب الهندسي والمعاين الميداني والمقيّم العقاري عند كتابتها في مهامهم."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="m-0 text-[12px] leading-relaxed text-text-3">
        عرض فقط — ملاحظات الأطراف المعيّنين على المعاملة (بدون إمكانية الرد أو
        الإنشاء من هنا).
      </p>
      {filled.map((section) => (
        <EngineeringPartyNotesSection
          key={section.id}
          title={section.title}
          remarks={section.remarks}
        />
      ))}
    </div>
  );
}

/** Build ordered sections for the notes tab from party submission remarks. */
export function buildPartyRemarksSections(input: {
  survey?: { remarks?: PartyNoteRow[] } | null;
  inspection?: { remarks?: PartyNoteRow[] } | null;
  appraisal?: { remarks?: PartyNoteRow[] } | null;
}): PartyRemarksSection[] {
  return [
    {
      id: "survey",
      title: "ملاحظات المكتب الهندسي",
      remarks: input.survey?.remarks ?? [],
    },
    {
      id: "inspection",
      title: "ملاحظات المعاين الميداني",
      remarks: input.inspection?.remarks ?? [],
    },
    {
      id: "appraisal",
      title: "ملاحظات المقيّم العقاري",
      remarks: input.appraisal?.remarks ?? [],
    },
  ];
}
