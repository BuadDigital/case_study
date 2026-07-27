"use client";

import { useEffect, useState } from "react";
import { InlineLoadingSkeleton, useToast } from "@platform/design-system";
import { EmptyState, SectionHeader, ltrValueClass } from "./PropertyDetailFields";
import {
  EngineeringPartyNotesSection,
  type PartyNoteRow,
} from "../fees/EngineeringPartyNotesSection";
import {
  loadPropertyNotes,
  savePropertyNotes,
  type PropertyNoteEntry,
} from "../../lib/prototype/property-detail-local-ui";
import { formatTimelineDate } from "../../lib/prototype/property-detail-timeline";

export function PropertyDetailSurveyNotesTab({
  remarks,
  loading,
  poNumber,
  propertyId,
  authorName = "أخصائي دراسة الحالة",
}: {
  remarks: PartyNoteRow[];
  loading: boolean;
  poNumber: string;
  propertyId: string;
  authorName?: string;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<PropertyNoteEntry[]>([]);
  const engRows = remarks.filter((row) => row.value.trim());

  useEffect(() => {
    setNotes(loadPropertyNotes(poNumber, propertyId));
  }, [poNumber, propertyId]);

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const next: PropertyNoteEntry[] = [
      {
        id: `n-${Date.now()}`,
        text,
        at: new Date().toISOString(),
        author: authorName,
      },
      ...notes,
    ];
    setNotes(next);
    savePropertyNotes(poNumber, propertyId, next);
    setDraft("");
    showToast("تم حفظ الملاحظة", "success");
  };

  return (
    <>
      <SectionHeader>ملاحظات العقار</SectionHeader>
      <div className="mb-4 rounded-[10px] border border-border bg-surface-2 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="أضف ملاحظة على العقار…"
          className="w-full resize-y rounded-[10px] border border-border-md bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-[#a4906f] focus:shadow-[0_0_0_3px_color-mix(in_srgb,#a4906f_20%,transparent)]"
        />
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={addNote}
            className="inline-flex min-h-9 items-center rounded-lg bg-ink px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-45 max-lg:min-h-11"
          >
            حفظ الملاحظة
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon="📝"
          title="لا توجد ملاحظات بعد"
          sub="الملاحظات المحفوظة هنا تظهر للفريق على مستوى هذا العقار."
        />
      ) : (
        <div className="mb-5 flex flex-col">
          {notes.map((note) => (
            <div
              key={note.id}
              className="border-b border-border py-3 last:border-b-0"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-text-3">
                <span className="font-bold text-heading">{note.author}</span>
                <span className={ltrValueClass}>{formatTimelineDate(note.at)}</span>
              </div>
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">
                {note.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {engRows.length > 0 ? (
        <EngineeringPartyNotesSection
          remarks={engRows}
          title="ملاحظات المكتب الهندسي"
        />
      ) : null}
    </>
  );
}
