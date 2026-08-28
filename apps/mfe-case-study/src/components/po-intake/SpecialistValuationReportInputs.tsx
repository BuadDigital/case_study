"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import {
  loadSpecialistPrintAttachmentKeys,
  printKeyForPropertyDocument,
  saveSpecialistPrintAttachmentKeys,
} from "../../lib/prototype/valuation-print-attachment-keys";
import type { PropertyDetailDocumentEntry } from "../../lib/prototype/property-detail-documents";
import { SpecialistValuationReportEsgEditor } from "./SpecialistValuationReportEsgEditor";
import { SpecialistValuationReportFinishingEditor } from "./SpecialistValuationReportFinishingEditor";
import { SpecialistValuationReportSearchScopeEditor } from "./SpecialistValuationReportSearchScopeEditor";

const FALLBACK_LABELS: Record<string, string> = {
  deed: "صك الملكية",
  survey: "التقرير المساحي",
  "zoning-sketch": "كروكي الموقع / التنظيم",
  "building-permit": "رخصة البناء",
};

type CatalogRow = { key: string; name: string; isRequired: boolean };

function SpecialistAttachmentsEditor({
  propertyId,
  documents,
}: {
  propertyId: string;
  documents: PropertyDetailDocumentEntry[];
}) {
  const [selectedKeys, setSelectedKeys] = useState(() =>
    loadSpecialistPrintAttachmentKeys(propertyId),
  );
  // قوائم التقييم عبر الاستعلام المشترك بدل جلب مباشر في useEffect —
  // نفس الكاش الذي تستخدمه شاشة المراجعة النهائية (client-swr-dedup).
  const { data: valuationLists } = useValuationListsQuery();

  useEffect(() => {
    setSelectedKeys(loadSpecialistPrintAttachmentKeys(propertyId));
  }, [propertyId]);

  const catalog = useMemo<CatalogRow[]>(
    () =>
      (valuationLists?.lists?.attachments ?? [])
        .filter((r) => r.isEnabled)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({
          key: r.key,
          name: r.name,
          isRequired: r.isRequired,
        })),
    [valuationLists],
  );

  const docsByKey = useMemo(() => {
    const map = new Map<string, PropertyDetailDocumentEntry[]>();
    for (const doc of documents) {
      const key = printKeyForPropertyDocument(doc);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    return map;
  }, [documents]);

  const rows = useMemo(() => {
    const base =
      catalog.length > 0
        ? catalog
        : Object.keys(FALLBACK_LABELS).map((key) => ({
            key,
            name: FALLBACK_LABELS[key] ?? key,
            isRequired: false,
          }));
    const seen = new Set(base.map((r) => r.key));
    const extra = [...docsByKey.keys(), ...selectedKeys]
      .filter((k) => !seen.has(k))
      .map((key) => ({
        key,
        name: FALLBACK_LABELS[key] ?? key,
        isRequired: false,
      }));
    return [...base, ...extra];
  }, [catalog, docsByKey, selectedKeys]);

  const toggleKey = useCallback(
    (key: string, selected: boolean) => {
      setSelectedKeys((prev) => {
        const next = selected
          ? prev.includes(key)
            ? prev
            : [...prev, key]
          : prev.filter((k) => k !== key);
        saveSpecialistPrintAttachmentKeys(propertyId, next);
        return next;
      });
    },
    [propertyId],
  );

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 py-3.5">
      <div className="mb-2 text-[13px] font-extrabold text-heading">
        مرفقات التقرير
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        حدّد المرفقات التي تدخل التقرير. تظهر للمقيّم في تقييم العقار للعرض فقط،
        وترتبط بما هو متوفر في مستندات العقار.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const docs = docsByKey.get(row.key) ?? [];
          const available = docs.length > 0;
          const hint = docs[0];
          return (
            <label
              key={row.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text"
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                checked={selectedKeys.includes(row.key)}
                onChange={(e) => toggleKey(row.key, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-heading">{row.name}</span>
                {row.isRequired ? (
                  <span className="ms-2 text-[10.5px] font-medium text-gold-d">
                    إلزامي في القوائم
                  </span>
                ) : null}
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-3">
                  {available && hint
                    ? `في مستندات العقار: ${hint.name} · ${hint.source}`
                    : "غير متوفر بعد في مستندات العقار"}
                </span>
              </span>
            </label>
          );
        })}
        {rows.length === 0 ? (
          <p className="m-0 text-[12px] text-text-3">
            لا توجد مرفقات معرفة بعد.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Specialist fills finishing + search scope + ESG + print attachments on تقييم العقار. */
export function SpecialistValuationReportInputs({
  propertyId,
  documents,
}: {
  propertyId: string;
  documents: PropertyDetailDocumentEntry[];
}) {
  // يعبّئها الأخصائي هنا (دراسة الحالة → تقييم العقار)، وتظهر للمقيّم للعرض فقط.
  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">
          مدخلات تقرير التقييم
        </h3>
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        يعبّئها الأخصائي من دراسة الحالة (تبويب تقييم العقار)، وتظهر للمقيّم للعرض
        فقط.
      </p>
      <SpecialistValuationReportFinishingEditor propertyId={propertyId} />
      <SpecialistValuationReportSearchScopeEditor propertyId={propertyId} />
      <SpecialistValuationReportEsgEditor propertyId={propertyId} />
      <SpecialistAttachmentsEditor
        propertyId={propertyId}
        documents={documents}
      />
    </div>
  );
}
