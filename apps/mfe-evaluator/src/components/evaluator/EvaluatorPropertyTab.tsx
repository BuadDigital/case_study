"use client";

import { cn } from "@platform/ui-kit";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import {
  downloadPropertyDetailDocument,
  type PropertyDetailDocumentEntry,
} from "@case-study/mfe/lib/prototype/property-detail-documents";
import { usePropertyDetailDocuments } from "@case-study/mfe/query/property-detail-documents-query";
import { EvaluatorCopyField } from "./EvaluatorChecklistTab";
import {
  EngField,
  EngInfo,
  EngSection,
  ValStatusPill,
} from "./EvaluatorHtmlPrimitives";

export type EvaluatorPropertySummary = {
  deedNumber: string;
  poNumber: string;
  classification: string;
  cityDistrict: string;
  assignedAt: string;
  inspectionDone: boolean;
  /** Live document sources — same as property detail. */
  property?: PoPropertyIntake | null;
  showDecree?: boolean;
  surveyTaskId?: string | null;
  inspectionTaskId?: string | null;
  appraisalTaskId?: string | null;
};

function docExtLabel(doc: PropertyDetailDocumentEntry): string {
  if (doc.kind === "pdf") return "PDF";
  if (doc.kind === "image") return "IMG";
  const parts = doc.fileName.trim().split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1]!.toUpperCase() : "DOC";
  return ext.slice(0, 4) || "DOC";
}

function TransactionDocumentRow({ doc }: { doc: PropertyDetailDocumentEntry }) {
  const canDownload = Boolean(
    doc.dataUrl || doc.attachmentId || doc.engineeringTaskId,
  );

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5",
        !canDownload && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-[9px] font-extrabold text-gold-d"
          aria-hidden
        >
          {docExtLabel(doc)}
        </span>
        <span className="inline-flex min-w-0 flex-col gap-px">
          <span className="truncate text-[12.5px] font-semibold text-text">
            {doc.name}
          </span>
          <span className="truncate text-[10.5px] text-text-3">
            {doc.source}
            {canDownload ? (
              <>
                {" · "}
                <span dir="ltr">{doc.fileName}</span>
              </>
            ) : null}
          </span>
        </span>
      </div>
      {canDownload ? (
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-md bg-surface px-3 py-1 text-[11px] font-bold text-text-2"
          onClick={() => downloadPropertyDetailDocument(doc)}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          تنزيل
        </button>
      ) : (
        <span className="shrink-0 text-[10.5px] text-text-3">لم يُرفع بعد</span>
      )}
    </div>
  );
}

function PropertyTransactionDocuments({
  property,
  showDecree,
  poNumber,
  surveyTaskId,
  appraisalTaskId,
  inspectionTaskId,
}: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
  surveyTaskId: string | null;
  appraisalTaskId: string | null;
  inspectionTaskId: string | null;
}) {
  const sections = usePropertyDetailDocuments({
    property,
    showDecree,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
  });
  const docs = sections.flatMap((section) => section.documents);

  if (docs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-md bg-surface px-3 py-4 text-center text-[12px] text-text-3">
        لا توجد مستندات مرفوعة بعد لهذه المعاملة.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {docs.map((doc) => (
        <TransactionDocumentRow key={doc.id} doc={doc} />
      ))}
    </div>
  );
}

export function EvaluatorPropertyTab({
  property,
}: {
  property: EvaluatorPropertySummary;
}) {
  return (
    <div>
      <EngInfo>
        تُستخدم هذه البيانات لتسجيل أمر عمل تقييم عقاري جديد في نظام التقييم —
        انسخ كل حقل بأيقونته ثم أكمل التقييم هناك وارفع تقريره في تبويب «التقييم».
      </EngInfo>

      <EngSection>بيانات الصك</EngSection>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <EvaluatorCopyField label="رقم الصك" value={property.deedNumber} />
        <EvaluatorCopyField label="أمر العمل" value={property.poNumber} />
        <EvaluatorCopyField label="التصنيف" value={property.classification} />
        <EvaluatorCopyField
          label="المدينة / الحي"
          value={property.cityDistrict}
        />
        <EvaluatorCopyField label="تاريخ الإسناد" value={property.assignedAt} />
        <EngField label="حالة المعاينة">
          <ValStatusPill
            label={property.inspectionDone ? "مكتملة" : "غير مكتملة"}
            color={property.inspectionDone ? "#3f8f5f" : "#d9694f"}
          />
        </EngField>
      </div>

      <EngSection>
        مستندات المعاملة — تُضاف من جميع الأطراف أثناء العمل
      </EngSection>
      <p className="-mt-1 mb-2.5 text-[11.5px] text-text-3">
        تتحدّث القائمة تلقائياً كلما أضاف طرف مستنداً — مثل التقرير المساحي عند
        إصداره من المكتب الهندسي.
      </p>
      {property.property ? (
        <PropertyTransactionDocuments
          property={property.property}
          showDecree={property.showDecree ?? false}
          poNumber={property.poNumber}
          surveyTaskId={property.surveyTaskId ?? null}
          appraisalTaskId={property.appraisalTaskId ?? null}
          inspectionTaskId={property.inspectionTaskId ?? null}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border-md bg-surface px-3 py-4 text-center text-[12px] text-text-3">
          تعذّر تحميل مستندات المعاملة — افتح تفاصيل العقار من قائمة أوامر العمل.
        </p>
      )}
    </div>
  );
}
