"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Label,
  Select,
  cn,
  useToast,
} from "@platform/ui-kit";
import {
  classifyAttachment,
  getAttachmentMeta,
  getAttachmentPrintDictionary,
  type AttachmentPrintTypeDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

const DOC_KIND_DEFAULT_TYPE: Record<string, string> = {
  decree: "deed",
  deed: "deed",
  "bourse-deed": "deed",
  registry: "deed",
  boundaries: "survey",
  delegation: "deed",
  photo: "photo",
  "site-map": "site-map",
  other: "",
  "keys-proof": "",
};

/**
 * Classify a library attachment for valuation report print.
 * Library ≠ report: print only when type is set and print-in-report is on.
 */
export function ReportAttachmentClassifyControls({
  attachmentId,
  docKind,
  propertyTypeKey,
  className,
}: {
  attachmentId: string;
  docKind?: string;
 /** filters dictionary types linked to specific property types (e.g. رخصة المباني للمباني). */
  propertyTypeKey?: string;
  className?: string;
}) {
  const { showToast } = useToast();
  const [types, setTypes] = useState<AttachmentPrintTypeDto[]>([]);
  const [typeKey, setTypeKey] = useState("");
  const [printInReport, setPrintInReport] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const reloadTypes = useCallback(async () => {
    const config = prototypeModulesApiConfig();
    if (!config) return;
    const res = await getAttachmentPrintDictionary(config);
    if (res.ok) {
      setTypes(res.data.types.filter((t) => t.isActive));
    }
  }, []);

  useEffect(() => {
    void reloadTypes();
  }, [reloadTypes]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);

    async function hydrate() {
      const config = prototypeModulesApiConfig();
      if (!config || !attachmentId) return;

      const res = await getAttachmentMeta(config, attachmentId);
      if (cancelled) return;

      if (res.ok) {
        const savedType = (res.data.dictionaryTypeKey || "").trim();
        if (savedType) {
          setTypeKey(savedType);
          setPrintInReport(Boolean(res.data.printInReport));
          setHydrated(true);
          return;
        }
      }

      const suggested =
        (docKind && DOC_KIND_DEFAULT_TYPE[docKind]) || "";
      setTypeKey(suggested);
      setPrintInReport(false);
      setHydrated(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [docKind, attachmentId]);

  async function persist(nextType: string, nextPrint: boolean) {
    const config = prototypeModulesApiConfig();
    if (!config || !attachmentId) return;
    setSaving(true);
    const res = await classifyAttachment(config, attachmentId, {
      dictionaryTypeKey: nextType,
      printInReport: nextPrint,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message || "تعذّر حفظ تصنيف المرفق", "error");
      return;
    }
    setTypeKey(res.data.dictionaryTypeKey || "");
    setPrintInReport(Boolean(res.data.printInReport));
    showToast("تم حفظ تصنيف مرفق التقرير", "success");
  }

  if (!attachmentId || !hydrated) return null;

  return (
    <div
      className={cn(
        "mt-1.5 w-full space-y-1.5 rounded-md border border-border bg-surface-2/50 p-2",
        className,
      )}
    >
      <p className="m-0 text-[10px] font-semibold text-text-2">
        مرفق التقرير (اختياري)
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[9rem] flex-1">
          <Label className="text-[10px] text-text-3">النوع</Label>
          <Select
            disabled={saving}
            value={typeKey}
            onChange={(e) => {
              const next = e.target.value;
              setTypeKey(next);
              void persist(next, next ? printInReport : false);
            }}
            className="text-[11px]"
          >
            <option value="">— غير مصنّف (مكتبة فقط) —</option>
            {types
              .filter(
                (t) =>
                  t.key === typeKey ||
                  t.propertyTypeKeys.length === 0 ||
                  !propertyTypeKey ||
                  t.propertyTypeKeys.some(
                    (k) => k.trim() === propertyTypeKey.trim(),
                  ),
              )
              .map((t) => (
                <option key={t.key} value={t.key}>
                  {t.labelAr}
                </option>
              ))}
          </Select>
        </div>
        <label
          className={cn(
            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px]",
            printInReport
              ? "border-ink bg-ink text-white"
              : "border-border bg-surface text-text-2",
            (!typeKey || saving) && "cursor-not-allowed opacity-50",
          )}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={printInReport}
            disabled={!typeKey || saving}
            onChange={(e) => {
              const next = e.target.checked;
              setPrintInReport(next);
              void persist(typeKey, next);
            }}
          />
          يُطبع في التقرير
        </label>
      </div>
    </div>
  );
}
