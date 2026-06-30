"use client";

import { InlineLoadingSkeleton } from "@platform/design-system";
import { EmptyState, SectionHeader } from "./PropertyDetailFields";
import {
  EngineeringPartyNotesSection,
  type PartyNoteRow,
} from "../fees/EngineeringPartyNotesSection";

export function PropertyDetailSurveyNotesTab({
  remarks,
  loading,
}: {
  remarks: PartyNoteRow[];
  loading: boolean;
}) {
  const rows = remarks.filter((row) => row.value.trim());

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <>
        <SectionHeader>ملاحظات المكتب الهندسي</SectionHeader>
        <EmptyState
          icon="📝"
          title="لا توجد ملاحظات"
          sub="تظهر هنا ما يكتبه المكتب الهندسي من تبويب «ملاحظة» في شاشة الرفع المساحي."
        />
      </>
    );
  }

  return (
    <EngineeringPartyNotesSection remarks={rows} title="ملاحظات المكتب الهندسي" />
  );
}
