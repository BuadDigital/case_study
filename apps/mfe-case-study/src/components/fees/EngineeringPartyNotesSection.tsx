"use client";

import { FieldBox, FieldsGrid, SectionHeader } from "../po-intake/PropertyDetailFields";

export type PartyNoteRow = { label: string; value: string };

export function EngineeringPartyNotesSection({
  remarks,
  title = "ملاحظات المكتب الهندسي",
}: {
  remarks: PartyNoteRow[];
  title?: string;
}) {
  const rows = remarks.filter((row) => row.value.trim());
  if (rows.length === 0) return null;

  return (
    <div className="mb-4">
      <SectionHeader>{title}</SectionHeader>
      <FieldsGrid cols={2}>
        {rows.map((row) => (
          <FieldBox
            key={`${row.label}-${row.value.slice(0, 24)}`}
            label={row.label}
            value={row.value}
            span={2}
          />
        ))}
      </FieldsGrid>
    </div>
  );
}
