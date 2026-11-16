"use client";

/**
 * «استيراد تقارير التقييم» — the periodic Excel export of an external valuation program (مقياس
 * first). Pick the source and the file → the server previews it (new / replaced / rejected, gaps)
 * → «اعتماد الاستيراد» saves it. A report with the same number is replaced; a report missing from
 * the file is never deleted. The reports appear on «خريطة العقارات» as the «تقارير التقييم» layer.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  commitValuationReportImport,
  listValuationReportImportBatches,
  listValuationReportSources,
  previewValuationReportImport,
  type ValuationReportImportPreviewDto,
  type ValuationReportImportRequest,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { dmy, formatArDateTime, formatDateAr } from "@platform/app-shared/format/date";
import { fmt } from "@platform/app-shared/format/number";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  cn,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  Select,
  StatCard,
  StatGrid,
  StatLabel,
  StatValue,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  useFileDropZone,
  useToast,
} from "@platform/ui-kit";
import { EXCEL_ACCEPT, importBlockReason, isExcelFile } from "./valuation-report-import-state";

const BATCHES_KEY = ["valuation-report-imports", "batches"] as const;

export function ValuationReportImportsView() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("");
  const [request, setRequest] = useState<ValuationReportImportRequest | null>(null);
  const [preview, setPreview] = useState<ValuationReportImportPreviewDto | null>(null);
  const [gapAcknowledged, setGapAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["valuation-report-imports", "sources"],
    queryFn: async () => {
      const config = apiConfig();
      if (!config) return [];
      const res = await listValuationReportSources(config);
      return res.ok ? res.data : [];
    },
    staleTime: Infinity,
  });
  const sourceKey = source || sources[0]?.key || "";

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: BATCHES_KEY,
    queryFn: async () => {
      const config = apiConfig();
      if (!config) return [];
      const res = await listValuationReportImportBatches(config);
      return res.ok ? res.data : [];
    },
  });

  function reset() {
    setRequest(null);
    setPreview(null);
    setGapAcknowledged(false);
  }

  async function pick(files: FileList | null | undefined) {
    const file = files?.[0];
    const config = apiConfig();
    if (!file || !config || !sourceKey || busy) return;
    if (!isExcelFile(file)) {
      showToast("الملف يجب أن يكون Excel (xlsx)", "error");
      return;
    }
    reset();
    setBusy("preview");
    const body: ValuationReportImportRequest = {
      source: sourceKey,
      fileName: file.name,
      contentBase64: await fileToBase64(file),
    };
    const res = await previewValuationReportImport(config, body);
    setBusy(null);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر قراءة الملف", "error");
      return;
    }
    setRequest(body);
    setPreview(res.data);
  }

  async function commit() {
    const config = apiConfig();
    if (!config || !request) return;
    setBusy("commit");
    const res = await commitValuationReportImport(config, request);
    setBusy(null);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تنفيذ الاستيراد", "error");
      return;
    }
    showToast(
      `تم الاستيراد: ${fmt(res.data.newCount)} جديد · ${fmt(res.data.replacedCount)} مستبدل`,
      "success",
    );
    reset();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
      queryClient.invalidateQueries({ queryKey: ["property-map", "valuation-reports"] }),
    ]);
  }

  const { dragOver, inputRef, zoneProps } = useFileDropZone({
    onFiles: (files) => void pick(files),
    disabled: busy !== null || !sourceKey,
  });
  const blockReason = preview ? importBlockReason(preview, gapAcknowledged) : null;

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <PageShellHeader
        title="استيراد تقارير التقييم"
        meta="ملف Excel مُصدَّر من برنامج التقييم — يُستبدل التقرير بنفس الرقم، ولا يُحذف تقرير غير موجود في الملف"
      />
      <PageGutter className="space-y-4 pb-8">
        <Card>
          <CardHeader>
            <strong className="text-[14px]">رفع ملف</strong>
          </CardHeader>
          <CardBody className="space-y-3">
            <label className="flex max-w-xs flex-col gap-1.5 text-[12px] font-semibold text-text-2">
              مصدر البيانات
              <Select
                value={sourceKey}
                disabled={busy !== null}
                onChange={(e) => {
                  setSource(e.target.value);
                  reset();
                }}
              >
                {sources.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.labelAr}
                  </option>
                ))}
              </Select>
            </label>
            <div
              role="button"
              tabIndex={0}
              aria-busy={busy === "preview" || undefined}
              aria-label="اختر ملف Excel أو اسحبه هنا"
              className={cn(
                "rounded-[10px] border-2 border-dashed px-4 py-6 text-center transition-[border-color,background]",
                busy ? "cursor-wait opacity-65" : "cursor-pointer",
                dragOver
                  ? "border-heading bg-[color-mix(in_srgb,var(--heading)_8%,transparent)]"
                  : "border-[#ddd8cc] bg-surface-2 hover:border-[#a4906f]",
              )}
              {...zoneProps}
            >
              <div className="text-[13px] font-bold text-heading">
                {busy === "preview"
                  ? "جاري قراءة الملف…"
                  : dragOver
                    ? "أفلِت الملف هنا"
                    : request
                      ? request.fileName
                      : "اختر ملف التصدير أو اسحبه هنا"}
              </div>
              <div className="mt-1 text-[11px] text-text-3">xlsx · تُطابق الأعمدة بأسمائها في ملف المصدر</div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={EXCEL_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                void pick(e.target.files);
                e.target.value = "";
              }}
            />
          </CardBody>
        </Card>

        {preview ? (
          <ImportPreview
            preview={preview}
            gapAcknowledged={gapAcknowledged}
            onGapAcknowledged={setGapAcknowledged}
            blockReason={blockReason}
            committing={busy === "commit"}
            onCommit={() => void commit()}
            onCancel={reset}
          />
        ) : null}

        <Card>
          <CardHeader>
            <strong className="text-[14px]">سجل الاستيراد</strong>
          </CardHeader>
          <Table pending={batchesLoading}>
            <THead>
              <Tr>
                <Th>التاريخ</Th>
                <Th>المصدر</Th>
                <Th>الملف</Th>
                <Th>بواسطة</Th>
                <Th>جديدة</Th>
                <Th>مستبدلة</Th>
                <Th>مرفوضة</Th>
              </Tr>
            </THead>
            <TBody>
              {batches.length === 0 ? (
                <TableEmptyRow colSpan={7}>لم يُستورد أي ملف بعد</TableEmptyRow>
              ) : (
                batches.map((b) => (
                  <Tr key={b.id}>
                    <Td>{formatArDateTime(b.importedAtUtc)}</Td>
                    <Td>{b.sourceLabelAr}</Td>
                    <TdLtr>{b.fileName}</TdLtr>
                    <Td>{b.importedByName || "—"}</Td>
                    <Td>{fmt(b.newCount)}</Td>
                    <Td>{fmt(b.replacedCount)}</Td>
                    <Td>{fmt(b.rejectedCount)}</Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </PageGutter>
    </PageShell>
  );
}

function ImportPreview({
  preview,
  gapAcknowledged,
  onGapAcknowledged,
  blockReason,
  committing,
  onCommit,
  onCancel,
}: {
  preview: ValuationReportImportPreviewDto;
  gapAcknowledged: boolean;
  onGapAcknowledged: (value: boolean) => void;
  blockReason: string | null;
  committing: boolean;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const gap = preview.previousBatchGap;
  const period =
    preview.firstApprovedAt && preview.lastApprovedAt
      ? `${formatDateAr(preview.firstApprovedAt)} — ${formatDateAr(preview.lastApprovedAt)}`
      : "—";

  return (
    <Card>
      <CardHeader>
        <strong className="text-[14px]">معاينة الملف</strong>
        <span className="text-[12px] text-text-3">
          فترة الاعتماد {period} · الأعمدة {fmt(preview.matchedColumns)}/{fmt(preview.requiredColumns)}
        </span>
      </CardHeader>
      <CardBody>
        <StatGrid cols={4}>
          <StatCard>
            <StatLabel>صفوف الملف</StatLabel>
            <StatValue value={fmt(preview.totalRows)} />
          </StatCard>
          <StatCard accent="green">
            <StatLabel>تقارير جديدة</StatLabel>
            <StatValue value={fmt(preview.newCount)} />
          </StatCard>
          <StatCard accent="amber">
            <StatLabel>تُستبدل (نفس الرقم)</StatLabel>
            <StatValue value={fmt(preview.replacedCount)} />
          </StatCard>
          <StatCard accent="red">
            <StatLabel>مرفوضة</StatLabel>
            <StatValue value={fmt(preview.rejectedCount)} />
          </StatCard>
        </StatGrid>

        {preview.missingColumns.length > 0 ? (
          <Note tone="danger">
            أعمدة إلزامية غير موجودة في الملف: {preview.missingColumns.join("، ")}
          </Note>
        ) : null}

        {gap ? (
          <Note tone="warn">
            <div className="font-bold">
              فجوة منذ آخر رفع: {fmt(gap.missingCount)} تقرير غير موجود
            </div>
            <div>
              آخر رقم في الرفع السابق {gap.lastNumber} ({dmy(gap.lastImportedAtUtc)})، وأول رقم في هذا
              الملف {gap.firstNumber}. تأكّد أن ملف التصدير يبدأ من بعد آخر رفع.
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={gapAcknowledged}
                onChange={(e) => onGapAcknowledged(e.target.checked)}
              />
              اطّلعت على الفجوة وأرغب في المتابعة
            </label>
          </Note>
        ) : !preview.hasPreviousBatch ? (
          <Note tone="info">أول استيراد من هذا المصدر.</Note>
        ) : null}

        {preview.internalGapCount > 0 ? (
          <Note tone="info">
            داخل الملف {fmt(preview.internalMissingCount)} رقم غير موجود في {fmt(preview.internalGapCount)} فجوة
            {preview.largestInternalGaps.length > 0
              ? ` — أكبرها: ${preview.largestInternalGaps
                  .map((g) => `${g.from}–${g.to} (${fmt(g.count)})`)
                  .join("، ")}`
              : ""}
            . للعلم فقط: الملف المفلتر يحتوي فجوات عادةً.
          </Note>
        ) : null}

        {preview.noValueCount > 0 ? (
          <Note>{fmt(preview.noValueCount)} تقرير بدون قيمة تقييم نهائية — يُستورد ويظهر بلا قيمة.</Note>
        ) : null}

        {preview.rejected.length > 0 ? (
          <Table className="mb-3">
            <THead>
              <Tr>
                <Th>رقم التقييم</Th>
                <Th>نوع العقار</Th>
                <Th>تاريخ الإعتماد</Th>
                <Th>سبب الرفض</Th>
              </Tr>
            </THead>
            <TBody>
              {preview.rejected.map((r, i) => (
                <Tr key={`${r.reportNumber}-${i}`}>
                  <TdLtr>{r.reportNumber || "—"}</TdLtr>
                  <Td>{r.propertyType || "—"}</Td>
                  <Td>{r.approvedAt ? formatDateAr(r.approvedAt) : "—"}</Td>
                  <Td>{r.reasonAr}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {blockReason ? <span className="text-[12px] text-text-3">{blockReason}</span> : null}
          <Button variant="ghost" onClick={onCancel} disabled={committing}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={onCommit} disabled={!!blockReason} loading={committing}>
            اعتماد الاستيراد
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
