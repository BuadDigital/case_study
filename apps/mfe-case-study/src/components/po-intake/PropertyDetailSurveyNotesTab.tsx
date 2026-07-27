"use client";

import { useEffect, useState } from "react";
import { InlineLoadingSkeleton, useToast } from "@platform/design-system";
import {
  EmptyState,
  SectionHeader,
  ltrValueClass,
} from "./PropertyDetailFields";
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

function NoteAvatar({ name }: { name: string }) {
  const initial = (name.trim()[0] || "م").toUpperCase();
  return (
    <span
      className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-[var(--gold-2,#e8dcc8)]"
      aria-hidden
    >
      {initial}
    </span>
  );
}

/**
 * Case Study.html `pdNotesHtml` layout — real notes only (no demo seed).
 */
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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const engRows = remarks.filter((row) => row.value.trim());

  useEffect(() => {
    setNotes(loadPropertyNotes(poNumber, propertyId));
  }, [poNumber, propertyId]);

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  const persist = (next: PropertyNoteEntry[]) => {
    setNotes(next);
    savePropertyNotes(poNumber, propertyId, next);
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const next: PropertyNoteEntry[] = [
      ...notes,
      {
        id: `n-${Date.now()}`,
        text,
        at: new Date().toISOString(),
        author: authorName,
        replies: [],
      },
    ];
    persist(next);
    setDraft("");
    showToast("تم حفظ الملاحظة", "success");
  };

  const addReply = (noteId: string) => {
    const text = (replyDrafts[noteId] ?? "").trim();
    if (!text) return;
    const next = notes.map((note) => {
      if (note.id !== noteId) return note;
      return {
        ...note,
        replies: [
          ...(note.replies ?? []),
          {
            id: `r-${Date.now()}`,
            text,
            at: new Date().toISOString(),
            author: authorName,
          },
        ],
      };
    });
    persist(next);
    setReplyDrafts((prev) => ({ ...prev, [noteId]: "" }));
    showToast("تم إرسال الرد", "success");
  };

  return (
    <>
      {notes.length === 0 ? (
        <EmptyState
          title="لا توجد ملاحظات بعد"
          sub="أضف ملاحظة أدناه لتبدأ المحادثة بين أطراف المعاملة."
        />
      ) : (
        <div className="mb-4 grid gap-3">
          {notes.map((note) => (
            <article
              key={note.id}
              className="rounded border border-border bg-surface-2 px-[13px] py-[11px]"
            >
              <div className="mb-1.5 flex items-center gap-[9px]">
                <NoteAvatar name={note.author} />
                <span className="min-w-0 flex-1 text-[11.5px] font-bold text-heading">
                  {note.author}
                </span>
                <span
                  className={`text-[10.5px] text-text-3 ${ltrValueClass}`}
                  dir="ltr"
                >
                  {formatTimelineDate(note.at)}
                </span>
              </div>
              <p className="m-0 text-xs leading-[1.7] text-pretty text-text-2">
                {note.text}
              </p>

              {(note.replies ?? []).length > 0 ? (
                <div className="mt-[9px] grid gap-2 border-s-2 border-border ps-2.5">
                  {(note.replies ?? []).map((reply) => (
                    <div key={reply.id}>
                      <div className="mb-[3px] flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-heading">
                          {reply.author}
                        </span>
                        <span
                          className={`text-[10px] text-text-3 ${ltrValueClass}`}
                          dir="ltr"
                        >
                          {formatTimelineDate(reply.at)}
                        </span>
                      </div>
                      <p className="m-0 text-[11.5px] leading-[1.7] text-text-2">
                        {reply.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-[9px] flex gap-2">
                <input
                  value={replyDrafts[note.id] ?? ""}
                  onChange={(e) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [note.id]: e.target.value,
                    }))
                  }
                  placeholder="اكتب ردك…"
                  className="min-h-[34px] min-w-0 flex-1 rounded-md border border-border-md bg-surface px-[11px] py-[7px] text-xs text-text outline-none focus:border-[#a4906f]"
                />
                <button
                  type="button"
                  disabled={!(replyDrafts[note.id] ?? "").trim()}
                  onClick={() => addReply(note.id)}
                  className="inline-flex shrink-0 items-center rounded-md bg-ink px-4 py-[7px] text-[11.5px] font-bold text-white disabled:opacity-45"
                >
                  إرسال
                </button>
              </div>
            </article>
          ))}
          <p className="m-0 text-[11.5px] text-text-3">
            محادثة بين أطراف المعاملة — مرتبة من الأقدم إلى الأحدث. يمكنك الرد
            على أي ملاحظة بصفتك {authorName}.
          </p>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="أضف ملاحظة جديدة…"
          className="min-h-[34px] min-w-0 flex-1 rounded-md border border-border-md bg-surface px-[11px] py-[7px] text-xs text-text outline-none focus:border-[#a4906f]"
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={addNote}
          className="inline-flex shrink-0 items-center rounded-md bg-ink px-4 py-[7px] text-[11.5px] font-bold text-white disabled:opacity-45"
        >
          إرسال
        </button>
      </div>

      {engRows.length > 0 ? (
        <>
          <SectionHeader>ملاحظات المكتب الهندسي</SectionHeader>
          <EngineeringPartyNotesSection remarks={engRows} />
        </>
      ) : null}
    </>
  );
}
