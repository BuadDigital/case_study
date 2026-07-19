"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cn, Note } from "@platform/design-system";
import type {
  DelegationAgentInfo,
  DelegationLetterProperty,
  InternalDelegationLetter,
} from "../../lib/prototype/internal-delegation-letters";
import {
  issueAndPrintDelegationLetter,
  updateDelegationLetterSelection,
} from "../../lib/prototype/internal-delegation-letters";
import { printInternalDelegationLetter } from "../../lib/prototype/internal-delegation-letter-html";
import { poPrimaryDataReadiness } from "../../lib/prototype/po-primary-data-readiness";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";

type Props = {
  letter: InternalDelegationLetter;
  records: PoIntakeRecord[];
  scopeKey: string;
  agent: DelegationAgentInfo;
  onRefresh: () => void;
};

export function InternalDelegationLetterPanel({
  letter,
  records,
  scopeKey,
  agent,
  onRefresh,
}: Props) {
  const readiness = useMemo(() => {
    const related = records.filter(
      (r) =>
        letter.selectedProperties.some(
          (p) => p.workOrder.trim() === r.poNumber.trim(),
        ) ||
        r.properties.some(
          (p) =>
            p.court.trim() === letter.court.trim() &&
            (p.circuit.trim() || "—") === letter.circuit.trim(),
        ),
    );
    if (related.length === 0) {
      return { ready: false, label: "لا توجد أوامر عمل مرتبطة" };
    }
    const results = related.map((r) => poPrimaryDataReadiness(r));
    const ready = results.every((x) => x.ready);
    return {
      ready,
      label: ready
        ? "جاهز"
        : (results.find((x) => !x.ready)?.label ?? "بيانات أولية ناقصة"),
    };
  }, [records, letter]);

  const availableProperties = useMemo(() => {
    const list: DelegationLetterProperty[] = [];
    for (const record of records) {
      for (const property of record.properties) {
        if (property.court.trim() !== letter.court.trim()) continue;
        if ((property.circuit.trim() || "—") !== letter.circuit.trim()) continue;
        list.push({
          propertyId: property.id,
          workOrder: record.poNumber.trim(),
          deedNo:
            formatPropertyDeedDisplay(property) ||
            property.deedNumber.trim() ||
            "—",
          owner: property.ownerName.trim() || "—",
          requestNo: property.requestNumber.trim() || "—",
        });
      }
    }
    return list;
  }, [records, letter.court, letter.circuit]);

  const issued = Boolean(letter.reference);
  const [selected, setSelected] = useState<DelegationLetterProperty[]>(
    () => letter.issuedProperties ?? letter.selectedProperties,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectionSyncKey = `${letter.reference ?? ""}|${letter.issuedAt ?? ""}|${(
    letter.issuedProperties ?? letter.selectedProperties
  )
    .map((p) => p.propertyId)
    .join(",")}`;

  // بعد الإصدار/التحديث من الأب — زامن الاختيار المحلي مع الخطاب.
  useEffect(() => {
    setSelected(letter.issuedProperties ?? letter.selectedProperties);
    setError(null);
    // selectionSyncKey يكفي لتتبع تغيّر المحتوى دون الاعتماد على هوية المصفوفة
  }, [letter.id, selectionSyncKey, letter.issuedProperties, letter.selectedProperties]);

  function toggleProperty(propertyId: string) {
    if (issued) return;
    const exists = selected.some((p) => p.propertyId === propertyId);
    const next = exists
      ? selected.filter((p) => p.propertyId !== propertyId)
      : [
          ...selected,
          availableProperties.find((p) => p.propertyId === propertyId)!,
        ].filter(Boolean);
    setSelected(next);
    setError(null);
    updateDelegationLetterSelection(scopeKey, letter.id, next);
    onRefresh();
  }

  async function handleIssueAndPrint() {
    if (!readiness.ready || selected.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (issued) {
        printInternalDelegationLetter(letter, agent);
        return;
      }
      const issuedLetter = await issueAndPrintDelegationLetter(
        scopeKey,
        { ...letter, selectedProperties: selected },
        agent,
      );
      if (!issuedLetter) {
        setError("تعذّر إصدار الخطاب. تأكد من صلاحيتك واتصال الـ API ثم أعد المحاولة.");
        return;
      }
      onRefresh();
      printInternalDelegationLetter(issuedLetter, agent);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-DEFAULT border border-border bg-surface-2/30">
      <div className="border-b border-border bg-surface px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[12px] font-semibold text-text">
            خطاب تفويض داخلي
          </h3>
          {issued ? (
            <Badge tone="success">{letter.reference}</Badge>
          ) : (
            <Badge tone="warning">مسودة</Badge>
          )}
        </div>
        <p className="m-0 mt-1 text-[11px] text-text-2">
          {letter.court} / {letter.circuit}
          {letter.city ? ` — ${letter.city}` : ""}
        </p>
      </div>

      <div className="px-3.5 py-3">
        <p className="mb-3 text-[11px] leading-relaxed text-text-2">
          اختر العقارات المشمولة في هذا الخطاب (محكمة + دائرة). قد تشمل أوامر عمل
          متعددة.
        </p>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {availableProperties.map((property) => {
            const checked = selected.some(
              (p) => p.propertyId === property.propertyId,
            );
            return (
              <li key={property.propertyId}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                    checked
                      ? "border-primary/50 bg-primary-light/40"
                      : "border-border bg-surface hover:border-primary/30 hover:bg-surface-2",
                    issued && "cursor-default opacity-90",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={checked}
                    disabled={issued}
                    onChange={() => toggleProperty(property.propertyId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-text">
                      {property.deedNo}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-text-3">
                      أمر {property.workOrder}
                      {property.owner !== "—" ? ` · ${property.owner}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {!readiness.ready ? (
          <Note tone="warn" className="mt-3 text-[11px]">
            الإصدار متاح بعد اكتمال البيانات الأولية لأوامر العمل المرتبطة (
            {readiness.label}).
          </Note>
        ) : null}

        {error ? (
          <Note tone="danger" className="mt-3 text-[11px]">
            {error}
          </Note>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full"
            disabled={!readiness.ready || selected.length === 0 || busy}
            onClick={() => void handleIssueAndPrint()}
          >
            {issued ? "إعادة طباعة الخطاب" : "إصدار وطباعة الخطاب"}
          </Button>
          <p className="m-0 text-center text-[10px] text-text-3">
            {selected.length === 0
              ? "لم يُختر أي عقار بعد"
              : `${selected.length} ${selected.length === 1 ? "عقار مختار" : "عقارات مختارة"}`}
          </p>
        </div>
      </div>
    </section>
  );
}
