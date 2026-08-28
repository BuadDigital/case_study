"use client";

/**
 * بوابة المكتب الهندسي — full stack (api/party-billing-statements)
 * Tailwind فقط (finance-tw) — بلا CSS/style objects.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmtMax } from "@platform/app-shared/format/number";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import {
  loadPartyBillingStatements,
  runSubmitVendorInvoice,
  uploadPartyBillingVendorInvoice,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { getEngineeringOffices } from "@case-study/mfe/lib/distribution-assignees";
import {
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
  useToast,
} from "@platform/ui-kit";
import { statementDisplayTotal } from "../lib/finance-cost-parties";
import { buildFinanceHref } from "../lib/finance-nav";
import {
  finCard,
  finEmptyS,
  finGhost,
  finNote,
  finPrimary,
  finSel,
  finSelCtrl,
  finCaret,
} from "../lib/finance-tw";
import { todayIso } from "@platform/app-shared/format/date";

// toLocaleString الافتراضي = حتى 3 كسور دون أصفار إلزامية — نحافظ على العرض نفسه.
function money(n: number) {
  return fmtMax(Number(n || 0), 3);
}


function periodFromIso(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
}

function isEngVendor(s: PartyBillingStatementDto): boolean {
  if (s.payeeType === "individual") return false;
  if (s.taskKind && s.taskKind !== "engineering-survey") return false;
  return true;
}

function isPortalAwaitingInvoice(s: PartyBillingStatementDto): boolean {
  return s.status === "issued" && isEngVendor(s);
}

const EMPTY_STAFF_USERS: Parameters<typeof getEngineeringOffices>[0] = [];

const fieldLbl = "text-[12px] font-semibold text-text-2";
const fieldInp =
  "w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-[9px] font-[inherit] text-[13px] text-text outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]";

export function FinanceEngOfficePortal({
  focusPartyId,
}: {
  focusPartyId?: string | null;
} = {}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;

  const offices = useMemo(
    () => getEngineeringOffices(staffUsers),
    [staffUsers],
  );

  const [localOffice, setLocalOffice] = useState("");
  const officeFilter =
    (focusPartyId?.trim() || localOffice || "").trim() || undefined;

  const statementsQuery = useQuery({
    queryKey: [
      ...prototypeKeys.all,
      "party-billing",
      "statements",
      "eng-portal",
      officeFilter ?? "all",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        issuedOrLaterOnly: false,
        assigneeId: officeFilter,
      }),
    staleTime: 15_000,
  });

  const engStatements = useMemo(
    () => (statementsQuery.data ?? []).filter(isEngVendor),
    [statementsQuery.data],
  );

  const portalRuns = useMemo(
    () =>
      engStatements
        .filter(isPortalAwaitingInvoice)
        .slice()
        .sort((a, b) =>
          (b.issuedAtUtc || b.createdAtUtc).localeCompare(
            a.issuedAtUtc || a.createdAtUtc,
          ),
        ),
    [engStatements],
  );

  const pipeline = useMemo(() => {
    let draft = 0;
    let awaitingInv = 0;
    let invReceived = 0;
    let closed = 0;
    for (const s of engStatements) {
      if (s.status === "draft") draft += 1;
      else if (s.status === "issued") awaitingInv += 1;
      else if (s.status === "invoice_received") invReceived += 1;
      else if (s.status === "closed") closed += 1;
    }
    return { draft, awaitingInv, invReceived, closed };
  }, [engStatements]);

  const [modalRunId, setModalRunId] = useState<string | null>(null);
  const [no, setNo] = useState("");
  const [date, setDate] = useState(todayIso);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const modalRun = portalRuns.find((r) => r.id === modalRunId) ?? null;
  const ready = !statementsQuery.isPending && !statementsQuery.isError;
  const portalEmpty = ready && portalRuns.length === 0;

  useEffect(() => {
    if (!modalRunId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalRunId, busy]);

  function openUpload(run: PartyBillingStatementDto) {
    setModalRunId(run.id);
    setNo("");
    setDate(todayIso());
    setFile(null);
    setErr("");
  }

  function closeModal() {
    setModalRunId(null);
    setErr("");
    setFile(null);
  }

  async function submit() {
    if (!modalRun) return;
    if (!no.trim()) {
      setErr("رقم الفاتورة إلزامي.");
      return;
    }
    if (!date.trim()) {
      setErr("تاريخ الفاتورة إلزامي.");
      return;
    }
    if (!file) {
      setErr("نسخة PDF إلزامية.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const upload = await uploadPartyBillingVendorInvoice(modalRun.id, file);
      if (!upload.ok) {
        setErr(upload.error);
        return;
      }
      const result = await runSubmitVendorInvoice(modalRun.id, {
        invoiceNumber: no.trim(),
        invoiceDate: date
          ? new Date(`${date}T12:00:00`).toISOString()
          : undefined,
        attachmentId: upload.id,
      });
      if (!result.ok) {
        setErr(result.error);
        return;
      }
      showToast("رُفعت الفاتورة على المسير — بانتظار مطابقة المالية");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "party-billing"],
      });
      setModalRunId(null);
      setFile(null);
      setErr("");
    } finally {
      setBusy(false);
    }
  }

  const costsStatementsHref = buildFinanceHref({
    area: "costs",
    section: "statements",
    party: officeFilter ?? null,
  });
  const costsDuesHref = buildFinanceHref({
    area: "costs",
    section: "dues",
    party: officeFilter ?? null,
  });

  return (
    <div
      data-screen-label="بوابة المكتب الهندسي"
      className="flex min-h-[min(62vh,560px)] flex-col"
    >
      <p className={finNote}>
        هذه الشاشة بعين المكتب الهندسي: يرفع فاتورة مطابقة للمسير المحوّل إليه.
        قيمة الفاتورة مقفلة على المسير ولا تُدخل يدوياً.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {offices.length > 1 && !focusPartyId ? (
          <label className="flex items-center gap-2 text-[12.5px] text-text-2">
            <span className="whitespace-nowrap font-semibold">المكتب</span>
            <div className={finSel}>
              <select
                className={cn(finSelCtrl, "min-w-[200px]")}
                value={localOffice}
                onChange={(e) => setLocalOffice(e.target.value)}
              >
                <option value="">كل المكاتب</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <span className={finCaret} aria-hidden>
                ▾
              </span>
            </div>
          </label>
        ) : null}

        <div className="ms-auto flex flex-wrap gap-2">
          <StatChip
            label="محوّلة بانتظار فاتورة"
            value={pipeline.awaitingInv}
            accent
          />
          <StatChip label="فاتورة واردة" value={pipeline.invReceived} />
          <StatChip label="مسير مُعد" value={pipeline.draft} />
        </div>
      </div>

      {statementsQuery.isError ? (
        <div
          className={cn(
            finCard,
            "flex flex-1 flex-col items-center justify-center px-6 py-12 text-center",
          )}
        >
          <div className="text-[14px] font-bold text-[#a32d2d]">
            تعذّر تحميل المسيرات
          </div>
          <p className={cn(finEmptyS, "mt-2 max-w-sm text-text-2")}>
            تحقق من اتصال خادم المالية ثم أعد المحاولة.
          </p>
          <button
            type="button"
            className={cn(finGhost, "mt-4")}
            onClick={() => void statementsQuery.refetch()}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {statementsQuery.isPending ? (
        <div
          className={cn(
            finCard,
            "flex flex-1 items-center justify-center py-[54px] text-[13px] text-text-3",
          )}
        >
          جاري تحميل المسيرات…
        </div>
      ) : null}

      {ready && portalRuns.length > 0 ? (
        <div className="flex flex-col gap-4">
          {portalRuns.map((s) => {
            const total = statementDisplayTotal(s);
            const payee = resolvePartyName(s.assigneeId, staffUsers);
            const period = periodFromIso(s.issuedAtUtc ?? s.createdAtUtc);
            const rejected = s.rejectedInvoices ?? [];
            const lineCount = s.lines?.length ?? 0;
            return (
              <div
                key={s.id}
                className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_1px_2px_rgba(18,40,76,0.03)]"
              >
                <div className="flex flex-wrap items-center gap-[18px] border-b border-border bg-surface-2 px-[18px] py-[15px]">
                  <Meta label="مسير الصرف">
                    <span
                      dir="ltr"
                      className="text-[14px] font-extrabold text-[#102B4E]"
                    >
                      {s.referenceNumber}
                    </span>
                  </Meta>
                  <Meta label="المكتب">
                    <span className="text-[13px] font-bold text-text">
                      {payee}
                    </span>
                  </Meta>
                  <Meta label="الشهر المالي">
                    <span
                      dir="ltr"
                      className="text-[13px] font-semibold text-text"
                    >
                      {period}
                    </span>
                  </Meta>
                  <Meta label="البنود">
                    <span className="text-[13px] font-bold text-text">
                      {lineCount}
                    </span>
                  </Meta>
                  <Meta label="قيمة المسير (مقفلة)">
                    <span
                      dir="ltr"
                      className="text-[15px] font-extrabold text-gold-d"
                    >
                      {money(total)}{" "}
                      <span className="text-[12px] font-semibold text-text-3">
                        ر.س
                      </span>
                    </span>
                  </Meta>
                  <span className="ms-auto inline-flex items-center whitespace-nowrap rounded-md bg-[color-mix(in_srgb,#102B4E_10%,transparent)] px-[11px] py-1 text-[12px] font-bold text-[#102B4E]">
                    بانتظار فاتورتكم
                  </span>
                </div>

                {rejected.length > 0 ? (
                  <div className="border-b border-border bg-[#fff8f6] px-[18px] py-[13px]">
                    <div className="mb-1.5 text-[12px] font-bold text-[#a32d2d]">
                      فاتورتك السابقة أُعيدت للتصحيح
                    </div>
                    {rejected.map((rj, i) => (
                      <div
                        key={`${rj.invoiceNumber}-${rj.rejectedAtUtc}-${i}`}
                        className="text-[12.5px] leading-[1.8] text-text-2"
                      >
                        <b dir="ltr">{rj.invoiceNumber || "—"}</b> —{" "}
                        {rj.reason || "أُعيدت للمراجعة"}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 px-[18px] py-4">
                  <button
                    type="button"
                    className={finPrimary}
                    onClick={() => openUpload(s)}
                  >
                    رفع الفاتورة على المسير
                  </button>
                  <span className="text-[12px] leading-snug text-text-3">
                    أصدر من برنامجك المحاسبي فاتورة بنفس القيمة ثم ارفع PDF.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {portalEmpty ? (
        <div
          className={cn(
            finCard,
            "flex flex-1 flex-col items-center justify-center px-7 py-14 text-center",
          )}
        >
          <div className="mb-4 grid h-[52px] w-[52px] place-items-center rounded-[14px] border border-border bg-surface-2 text-text-3">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
              <path d="M9 10v10" />
            </svg>
          </div>
          <div className="mb-2 text-[15px] font-extrabold text-[#102B4E]">
            لا مسيرات محوّلة بانتظار فاتورة
          </div>
          <p className="mb-5 max-w-[420px] text-[12.5px] leading-[1.85] text-text-2">
            تظهر هنا بعد أن تُعدّ المالية المسير من التكاليف ثم{" "}
            <b className="font-bold text-text">تحوّله للمكتب</b>. المكتب يرفع
            فاتورة مطابقة للقيمة المقفلة.
          </p>

          {(pipeline.draft > 0 || pipeline.invReceived > 0) && (
            <div className="mb-[18px] flex flex-wrap justify-center gap-2 text-[12px] text-text-2">
              {pipeline.draft > 0 ? (
                <span className="rounded-lg border border-border bg-surface-2 px-3 py-1">
                  {pipeline.draft} مسير مُعد لدى المالية (لم يُحوَّل بعد)
                </span>
              ) : null}
              {pipeline.invReceived > 0 ? (
                <span className="rounded-lg border border-border bg-surface-2 px-3 py-1">
                  {pipeline.invReceived} فاتورة واردة بانتظار مطابقة المالية
                </span>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href={costsStatementsHref} className={finPrimary}>
              فتح مسيرات التكاليف
            </Link>
            <Link href={costsDuesHref} className={finGhost}>
              المستحقات الجاهزة
            </Link>
          </div>
        </div>
      ) : null}

      {modalRun ? (
        <ModalOverlay
          role="presentation"
          className="items-start bg-[rgba(16,43,78,0.42)] pt-[6vh] !z-[var(--z-modal)]"
          onClick={closeModal}
        >
          <ModalCard
            wide
            className="max-w-[640px] rounded-2xl shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader className="justify-between px-[22px] py-4">
              <ModalTitle className="text-start text-base font-extrabold text-[#102B4E]">
                رفع فاتورة على المسير {modalRun.referenceNumber}
              </ModalTitle>
              <ModalClose
                onClick={closeModal}
                aria-label="إغلاق"
                className="grid h-8 w-8 place-items-center rounded-[9px] bg-surface-2 text-[15px] text-text-2"
              >
                ✕
              </ModalClose>
            </ModalHeader>

            <ModalBody className="px-[22px] py-5">
              {err ? (
                <div className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-[13px] py-2.5 text-[12.5px] font-semibold leading-[1.7] text-[#a32d2d]">
                  {err}
                </div>
              ) : null}

              <p className={cn(finNote, "mb-4")}>
                القيمة مقفلة على المسير — أصدر فاتورة مطابقة له وارفع نسخة PDF.
              </p>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className={fieldLbl}>
                    قيمة الفاتورة — مقفلة على المسير
                  </label>
                  <div
                    dir="ltr"
                    className="rounded-[9px] border border-border bg-[#f1ece2] px-3 py-2.5 text-[14px] font-extrabold text-[#102B4E]"
                  >
                    {money(statementDisplayTotal(modalRun))} ر.س
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={fieldLbl}>رقم الفاتورة</label>
                  <input
                    dir="ltr"
                    className={fieldInp}
                    value={no}
                    placeholder="INV-2310"
                    disabled={busy}
                    onChange={(e) => {
                      setNo(e.target.value);
                      setErr("");
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={fieldLbl}>تاريخ الفاتورة</label>
                  <input
                    dir="ltr"
                    type="date"
                    className={fieldInp}
                    value={date}
                    disabled={busy}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setErr("");
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className={fieldLbl}>نسخة PDF (إلزامية)</label>
                  <div className="flex items-center gap-2.5">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/pdf,image/*"
                      hidden
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        setFile(f);
                        setErr("");
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className={finGhost}
                      onClick={() => fileRef.current?.click()}
                    >
                      إرفاق PDF
                    </button>
                    <span className="text-[12.5px] font-semibold text-gold-d">
                      {file?.name || "لم يُرفق ملف بعد"}
                    </span>
                  </div>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5">
              <button
                type="button"
                className={finGhost}
                disabled={busy}
                onClick={closeModal}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={cn(finPrimary, busy && "opacity-75")}
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? "جارٍ الرفع…" : "رفع الفاتورة"}
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-[3px] text-[11px] text-text-3">{label}</div>
      {children}
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-lg border px-[11px] py-[5px] text-[12px] font-semibold",
        accent
          ? "border-[#102B4E] bg-[color-mix(in_srgb,#102B4E_8%,#ffffff)] text-[#102B4E]"
          : "border-border bg-surface text-text-2",
      )}
    >
      <span className="font-extrabold tabular-nums">{value}</span>
      {label}
    </span>
  );
}
