"use client";

/**
 * Documents tab of `PoPropertyDetailTabs` — per-source sections with a download
 * row each. Labels come from `po-property-detail-tabs-state.ts`.
 */

import { InfoBox, ltrValueClass } from "./PropertyDetailFields";
import {
  downloadPropertyDetailDocument,
  type PropertyDetailDocumentEntry,
  type PropertyDetailDocumentSection,
} from "../../lib/app-data/property-detail-documents";
import {
  docKindLabel,
  isGeneratedFileName,
} from "./po-property-detail-tabs-state";

function DocumentRow({ doc }: { doc: PropertyDetailDocumentEntry }) {
  const kind = docKindLabel(doc);
  const showFileName = doc.fileName.trim().length > 0 && !isGeneratedFileName(doc.fileName);

  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex h-[30px] min-w-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-[color-mix(in_srgb,#a4906f_14%,transparent)] px-1.5 text-[10px] font-extrabold text-[#8c7857]"
            aria-hidden
          >
            {kind}
          </span>
          <span className="inline-flex min-w-0 flex-col gap-px">
            <span className="truncate text-[12.5px] font-semibold text-text">
              {doc.name}
            </span>
            <span className="truncate text-[10.5px] text-text-3">
              {doc.source}
              {showFileName ? (
                <>
                  {" · "}
                  <bdi dir="ltr" className={ltrValueClass}>
                    {doc.fileName}
                  </bdi>
                </>
              ) : null}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border-md bg-surface px-3 py-1 text-[11px] font-bold text-text-2 max-lg:min-h-11"
          onClick={() => downloadPropertyDetailDocument(doc)}
        >
          تنزيل
        </button>
      </div>
    </div>
  );
}

export function DocumentsTab({
  sections,
}: {
  sections: PropertyDetailDocumentSection[];
}) {
  if (sections.length === 0) {
    return (
      <InfoBox icon="ℹ">لا توجد مستندات مرفوعة لهذا العقار بعد.</InfoBox>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <section key={section.id} className="mb-3.5">
          <div className="mb-[7px] flex items-center gap-2">
            <span className="text-xs font-bold text-heading">{section.title}</span>
            <span className="text-[10.5px] text-text-3">
              {section.documents.length} مستند
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <div className="grid gap-2">
            {section.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      ))}
      <p className="m-0 text-[11.5px] text-text-3">
        تُرفع المستندات من كل طرف تحت قسمه — التقرير المساحي من المكتب الهندسي
        عند إصداره، وتقرير المعاينة عند اكتمالها. مرفقات التقرير يحدّدها الأخصائي
        من تبويب تقييم العقار.
      </p>
    </>
  );
}

