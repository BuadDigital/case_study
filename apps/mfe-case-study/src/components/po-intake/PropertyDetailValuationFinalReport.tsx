"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getIssuancePdf,
  getOpenValuationRequestByProperty,
  getReportIssuanceState,
  getValuationReportPdf,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { Button, Spinner, cn } from "@platform/ui-kit";
import { EmptyState } from "./PropertyDetailFields";

type ReportCopy = "final" | "deposit" | "preview";

const STAGE_LABEL: Record<string, string> = {
  draft: "مسودة",
  deposit_issued: "نسخة الإيداع",
  final_issued: "النسخة النهائية",
};

const COPY_LABEL: Record<ReportCopy, string> = {
  final: "النسخة النهائية",
  deposit: "نسخة الإيداع",
  preview: "معاينة المسودة",
};

function copyFor(state: { hasFinalPdf: boolean; hasDepositPdf: boolean } | null): ReportCopy {
  if (state?.hasFinalPdf) return "final";
  if (state?.hasDepositPdf) return "deposit";
  return "preview";
}

/**
 * Specialist view of the valuation report for one property: the final issued PDF when it
 * exists, otherwise the deposit copy, otherwise the live preview of the draft. Read-only;
 * accept / return actions stay in the package review bar above it.
 */
export function PropertyDetailValuationFinalReport({
  propertyId,
}: {
  propertyId: string;
}) {
  const config = useMemo(() => apiConfig(), []);

  const requestQuery = useQuery({
    queryKey: ["valuation-request", "open-by-property", propertyId],
    enabled: Boolean(config && propertyId),
    queryFn: async () => {
      const res = await getOpenValuationRequestByProperty(config!, propertyId);
      if (res.ok) return res.data;
      if (res.kind === "not_found") return null;
      throw new Error(res.kind);
    },
  });
  const requestId = requestQuery.data?.id ?? null;

  const issuanceQuery = useQuery({
    queryKey: ["valuation-request", requestId, "issuance"],
    enabled: Boolean(config && requestId),
    queryFn: async () => {
      const res = await getReportIssuanceState(config!, requestId!);
      if (res.ok) return res.data;
      if (res.kind === "not_found") return null;
      throw new Error(res.kind);
    },
  });

  const copy = copyFor(issuanceQuery.data ?? null);

  const pdfQuery = useQuery({
    queryKey: ["valuation-request", requestId, "report-pdf", copy],
    enabled: Boolean(config && requestId && issuanceQuery.isSuccess),
    staleTime: 60_000,
    queryFn: async () => {
      const res =
        copy === "preview"
          ? await getValuationReportPdf(config!, requestId!)
          : await getIssuancePdf(config!, requestId!, copy);
      if (res.ok) return res.data;
      if (res.kind === "not_found") return null;
      throw new Error(res.kind);
    },
  });

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = pdfQuery.data;
    if (!blob) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfQuery.data]);

  if (!config) return null;

  if (requestQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-xs text-text-3">
        <Spinner className="size-4" />
        جارٍ تحميل تقرير التقييم…
      </div>
    );
  }

  if (requestQuery.isError) {
    return (
      <EmptyState
        title="تعذّر تحميل تقرير التقييم"
        sub="أعد المحاولة لاحقاً أو تحقق من الاتصال."
      />
    );
  }

  if (!requestQuery.data) {
    return (
      <EmptyState
        title="لم يُنشأ تقرير التقييم بعد"
        sub="يظهر التقرير النهائي هنا بعد أن يبدأ المقيّم العمل على العقار."
      />
    );
  }

  const stage = issuanceQuery.data?.stage ?? "draft";
  const fileName =
    copy === "final"
      ? "النسخة-النهائية.pdf"
      : copy === "deposit"
        ? "نسخة-الإيداع.pdf"
        : `${requestQuery.data.displayId || "تقرير-التقييم"}.pdf`;

  function download() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-bold text-heading">التقرير النهائي</h3>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              stage === "final_issued"
                ? "border-success/30 bg-success-bg text-success-text"
                : stage === "deposit_issued"
                  ? "border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-gold-d"
                  : "border-border bg-surface-2 text-text-2",
            )}
          >
            {STAGE_LABEL[stage] ?? stage}
          </span>
          <span className="text-[11px] text-text-3" dir="ltr">
            {requestQuery.data.displayId}
          </span>
          {issuanceQuery.data?.version && issuanceQuery.data.version > 1 ? (
            <span className="text-[11px] text-text-3">
              الجولة {issuanceQuery.data.version}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!blobUrl}
            onClick={() => {
              if (blobUrl) window.open(blobUrl, "_blank", "noopener");
            }}
          >
            فتح في نافذة
          </Button>
          <Button size="sm" variant="primary" disabled={!blobUrl} onClick={download}>
            تنزيل PDF
          </Button>
        </div>
      </div>

      {pdfQuery.isLoading || (pdfQuery.isSuccess && pdfQuery.data && !blobUrl) ? (
        <div className="flex items-center gap-2 px-1 py-6 text-xs text-text-3">
          <Spinner className="size-4" />
          جارٍ تجهيز {COPY_LABEL[copy]}…
        </div>
      ) : pdfQuery.isError ? (
        <EmptyState
          title="تعذّر تحميل ملف التقرير"
          sub="أعد المحاولة لاحقاً أو افتح التقرير من مساحة عمل المقيّم."
        />
      ) : !pdfQuery.data ? (
        <EmptyState
          title="لا يوجد ملف تقرير بعد"
          sub="يظهر الملف هنا بعد أن يكمل المقيّم مسودة التقرير أو يصدرها."
        />
      ) : blobUrl ? (
        <iframe
          title={`تقرير التقييم — ${COPY_LABEL[copy]}`}
          src={blobUrl}
          className="h-[78vh] min-h-[560px] w-full rounded-lg border border-border bg-white"
        />
      ) : null}
    </section>
  );
}
