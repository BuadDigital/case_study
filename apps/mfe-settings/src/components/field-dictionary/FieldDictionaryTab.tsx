"use client";

import { useMemo, useState } from "react";
import { PageShell, cn, opsFldControl, opsIconBoxGold, opsLetterCard, opsLetterHead, opsLetterMeta, opsLetterSub, opsLetterTitle, opsTfSeg, opsTfSegActive, opsTfSegRow } from "@platform/ui-kit";
import {
  FIELD_DICTIONARY_STAGES,
  fieldsForDictionaryStage,
  propertyFieldsCatalogTotalCount,
  type FieldDictionaryStageId,
} from "@platform/app-shared/app-data/property-fields-catalog";

function DictionaryIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
    </svg>
  );
}

export function FieldDictionaryTab() {
  const [stageId, setStageId] = useState<FieldDictionaryStageId>("primary");
  const [query, setQuery] = useState("");

  const stage = FIELD_DICTIONARY_STAGES.find((item) => item.id === stageId);
  const totalInStage = fieldsForDictionaryStage(stageId).length;

  const fields = useMemo(() => {
    const q = query.trim();
    const list = fieldsForDictionaryStage(stageId);
    if (!q) return list;
    return list.filter(
      (field) => field.label.includes(q) || field.key.toLowerCase().includes(q.toLowerCase()),
    );
  }, [query, stageId]);

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
    >
      <div
        className={cn(opsTfSegRow, "mb-3.5")}
        role="tablist"
        aria-label="مراحل قاموس الحقول"
      >
        {FIELD_DICTIONARY_STAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={stageId === item.id}
            className={stageId === item.id ? opsTfSegActive : opsTfSeg}
            onClick={() => setStageId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <DictionaryIcon />
            </span>
            <div>
              <div className={opsLetterTitle}>قاموس الحقول المركزي</div>
              <div className={opsLetterSub}>
                حقول كل مرحلة وطرف — البيانات الأولية، البورصة، المعاين، التقييم،
                المراجع الحكومي، المكتب الهندسي، والمالية
              </div>
            </div>
          </div>
          <span className={opsLetterMeta}>
            {propertyFieldsCatalogTotalCount()} حقل إجمالاً
          </span>
        </div>

        <div className="px-4 pb-[18px] pt-4 sm:px-[18px]">
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <input
              className={cn(opsFldControl, "max-w-xs")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في حقول هذا القسم…"
            />
            <span className="text-[11.5px] font-semibold text-text-3">
              {fields.length}
              {query.trim() ? `/${totalInStage}` : ""} حقل — {stage?.label}
            </span>
          </div>

          {fields.length === 0 ? (
            <p className="py-10 text-center text-xs text-text-3">
              لا توجد حقول في هذا القسم
            </p>
          ) : (
            <ol className="m-0 list-none divide-y divide-border rounded-[10px] border border-border-md p-0">
              {fields.map((field, index) => (
                <li
                  key={`${field.key}-${index}`}
                  className="flex items-baseline gap-3 px-3.5 py-2.5"
                >
                  <span className="w-7 shrink-0 text-end text-[11px] tabular-nums text-text-3">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-text">
                    {field.label}
                  </span>
                  <span
                    dir="ltr"
                    className="hidden shrink-0 font-mono text-[10px] text-text-3 sm:inline"
                  >
                    {field.key}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </PageShell>
  );
}
