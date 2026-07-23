"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, QueueTableHint, Tab, TabBar, TabPanel } from "@platform/design-system";
import { KeyEnvelopeFeesPanel } from "@keys/mfe/components/KeyEnvelopeFeesPanel";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { InspectorFeesBillingTable } from "../field-inspection/InspectorFeesBillingTable";
import { PartyFeeWorkflowTable } from "./PartyFeeWorkflowTable";
import { PartyDisbursementRequest } from "./PartyDisbursementRequest";
import { PartyReturnedQueue } from "./PartyReturnedQueue";
import { SupervisorEnfazTracking } from "./SupervisorEnfazTracking";
import { CourtVisitFeesPanel } from "./CourtVisitFeesPanel";
import { PartyPropertyBrowse } from "@platform/app-shared/fees/PartyPropertyBrowse";
import {
  resolvePartyCategory,
  resolvePartyName,
  sortInspectorFeeRowsNewestFirst,
} from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

type PartyFeesTab =
  | "fees"
  | "preliminary"
  | "visit-fees"
  | "key-fees"
  | "disburse"
  | "returned"
  | "financial"
  | "browse";

export function PartyFeesWorkspace({
  variant,
  assigneeId,
  isSupervisor,
}: {
  variant: "field-inspection" | "engineering-survey" | "government-review";
  assigneeId?: string;
  isSupervisor: boolean;
}) {
  const isEngineering = variant === "engineering-survey";
  const [tab, setTab] = useState<PartyFeesTab>(
    isSupervisor ? "financial" : isEngineering ? "preliminary" : "fees",
  );
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const { data: summary, isLoading, isFetched } = useInspectorFeesQuery(
    {
      assigneeId: isSupervisor ? undefined : assigneeId,
      submittedOnly: false,
      taskKind: isSupervisor ? undefined : variant,
    },
    { enabled: isSupervisor || Boolean(assigneeId) },
  );

  const rows = useMemo(
    () => sortInspectorFeeRowsNewestFirst(summary?.rows ?? []),
    [summary?.rows],
  );
  const supReviewRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "sup-review"),
    [rows],
  );
  const returnedToSup = useMemo(
    () =>
      rows.filter(
        (r) => r.billingStatus === "returned" && r.returnTo === "supervisor",
      ),
    [rows],
  );

  const officeReviewRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "office-review"),
    [rows],
  );
  const disputedRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "disputed"),
    [rows],
  );
  const readyBillingRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.billingStatus === "at-finance" ||
          r.billingStatus === "disb-req",
      ),
    [rows],
  );

  const showVisitAndKeyFees =
    variant === "government-review" || isSupervisor;

  return (
    <div className="flex min-h-0 flex-col gap-3 px-4 py-4">
      {isSupervisor ? (
        <TabBar className="mb-3">
          <Tab active={tab === "financial"} onClick={() => setTab("financial")}>
            الأمور المالية
            {supReviewRows.length + returnedToSup.length + disputedRows.length > 0
              ? ` (${supReviewRows.length + returnedToSup.length + disputedRows.length})`
              : ""}
          </Tab>
          <Tab active={tab === "fees"} onClick={() => setTab("fees")}>
            الحسم والمراجعة
          </Tab>
          <Tab active={tab === "visit-fees"} onClick={() => setTab("visit-fees")}>
            أتعاب الزيارة
          </Tab>
          <Tab active={tab === "key-fees"} onClick={() => setTab("key-fees")}>
            أتعاب استلام المفاتيح
          </Tab>
        </TabBar>
      ) : (
        <TabBar className="mb-3">
          {isEngineering ? (
            <Tab
              active={tab === "preliminary"}
              onClick={() => setTab("preliminary")}
            >
              الكشف المبدئي
              {officeReviewRows.length > 0
                ? ` (${officeReviewRows.length})`
                : ""}
            </Tab>
          ) : null}
          <Tab active={tab === "browse"} onClick={() => setTab("browse")}>
            عقاراتي وحالاتها
          </Tab>
          <Tab active={tab === "fees"} onClick={() => setTab("fees")}>
            {isEngineering ? "الجاهزة للفوترة" : "أتعاب المعاملة"}
          </Tab>
          {showVisitAndKeyFees ? (
            <Tab
              active={tab === "visit-fees"}
              onClick={() => setTab("visit-fees")}
            >
              أتعاب الزيارة
            </Tab>
          ) : null}
          {showVisitAndKeyFees ? (
            <Tab active={tab === "key-fees"} onClick={() => setTab("key-fees")}>
              أتعاب استلام المفاتيح
            </Tab>
          ) : null}
          {!isEngineering ? (
            <Tab active={tab === "disburse"} onClick={() => setTab("disburse")}>
              طلب صرف
            </Tab>
          ) : null}
          {!isEngineering ? (
            <Tab active={tab === "returned"} onClick={() => setTab("returned")}>
              المُعاد لي
            </Tab>
          ) : null}
        </TabBar>
      )}

      <TabPanel>
        {tab === "preliminary" && isEngineering && !isSupervisor ? (
          <>
            <PartyFeeWorkflowTable
              rows={rows}
              role="office"
              pending={isLoading && !isFetched}
            />
            <QueueTableHint className="mt-3">
              الكشف المبدئي: معاملاتك المستحقة بعد قبول الأخصائي للمخرجات. البنود
              بسعر الجدول جاهزة تلقائياً. البنود المخصومة تحتاج موافقتك أو
              اعتراضك قبل وصولها للمالية.
            </QueueTableHint>
          </>
        ) : null}

        {tab === "fees" ? (
          isSupervisor ? (
            <>
              <InspectorFeesBillingTable
                rows={rows}
                mode="supervisor"
                pending={isLoading && !isFetched}
              />
              <QueueTableHint className="mt-3">
                الحسم هنا — للمكتب الهندسي: الخصم يُرسل لموافقة المكتب قبل المالية.
                {variant === "government-review" || isSupervisor
                  ? " مسار المهام التشغيلية (زيارة محكمة) يظهر في «أتعاب الزيارة»."
                  : ""}
              </QueueTableHint>
            </>
          ) : isEngineering ? (
            <>
              <PartyFeeWorkflowTable
                rows={readyBillingRows}
                role="office"
                pending={isLoading && !isFetched}
              />
              <QueueTableHint className="mt-3">
                البنود الجاهزة للفوترة بعد موافقة المكتب أو بسعر الجدول. ستُدرج لاحقاً
                في كشف/فاتورة المكتب — لا يُنشأ لها أمر صرف من هذا المسار.
              </QueueTableHint>
            </>
          ) : (
            <>
              <PartyFeeWorkflowTable
                rows={rows}
                role="office"
                pending={isLoading && !isFetched}
              />
              <QueueTableHint className="mt-3">
                بعد إنجاز العمل ارفع المعاملة للمشرف. الأتعاب تظهر بعد اكتمال
                دراسة الحالة للصك. وعند جاهزيتها للصرف أنشئ «أمر صرف» من تبويب
                طلب الصرف.
                {showVisitAndKeyFees
                  ? " أتعاب زيارة المحكمة من المهام التشغيلية في تبويب «أتعاب الزيارة»."
                  : ""}
              </QueueTableHint>
            </>
          )
        ) : null}

        {tab === "visit-fees" && showVisitAndKeyFees ? (
          <CourtVisitFeesPanel
            creditAssigneeId={isSupervisor ? undefined : assigneeId}
          />
        ) : null}

        {tab === "key-fees" && showVisitAndKeyFees ? (
          <>
            <KeyEnvelopeFeesPanel
              canCollect
              onOpenEnvelope={(envelopeId) => {
                window.location.assign(
                  `/keys?envelope=${encodeURIComponent(envelopeId)}`,
                );
              }}
            />
            <QueueTableHint className="mt-3">
              أتعاب استلام ظرف المفاتيح (سيناريو المحكمة + صورة). منفصلة عن أتعاب
              الزيارة. التفاصيل الكاملة من{" "}
              <Link
                href="/keys?tab=fees"
                className="font-semibold text-primary underline underline-offset-2"
              >
                إدارة المفاتيح → تقرير الأتعاب
              </Link>
              .
            </QueueTableHint>
          </>
        ) : null}

        {tab === "financial" && isSupervisor ? (
          <div className="flex flex-col gap-4">
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                الواردة للاعتماد
              </h3>
              {supReviewRows.length === 0 ? (
                <EmptyState line="لا معاملات بانتظار الاعتماد." />
              ) : (
                <PartyFeeWorkflowTable rows={supReviewRows} role="supervisor" />
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                خلاف تسعير (مكتب هندسي)
              </h3>
              {disputedRows.length === 0 ? (
                <EmptyState line="لا بنود خلاف تسعير." />
              ) : (
                <PartyFeeWorkflowTable rows={disputedRows} role="supervisor" />
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                المُعاد من المالية
              </h3>
              {returnedToSup.length === 0 ? (
                <EmptyState line="لا معاملات مُعادة من المالية." />
              ) : (
                <PartyFeeWorkflowTable rows={returnedToSup} role="supervisor" />
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                متابعة فوترة إنفاذ
              </h3>
              <SupervisorEnfazTracking />
            </section>
          </div>
        ) : null}

        {tab === "disburse" && !isSupervisor && !isEngineering ? (
          <PartyDisbursementRequest
            rows={rows.filter((r) => r.canCreateDisbursementRequest)}
          />
        ) : null}

        {tab === "returned" && !isSupervisor && !isEngineering ? (
          <PartyReturnedQueue rows={rows} />
        ) : null}

        {tab === "browse" && !isSupervisor ? (
          <PartyPropertyBrowse
            rows={rows}
            partyName={resolvePartyName(assigneeId, staffUsers)}
            partyCategory={resolvePartyCategory(
              assigneeId ?? "",
              rows,
              staffUsers,
            )}
            pending={isLoading && !isFetched}
          />
        ) : null}
      </TabPanel>
    </div>
  );
}
