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
import { PartyPropertyBrowse } from "@platform/app-shared/fees/PartyPropertyBrowse";
import {
  resolvePartyCategory,
  resolvePartyName,
  sortInspectorFeeRowsNewestFirst,
} from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

type PartyFeesTab = "fees" | "key-fees" | "disburse" | "returned" | "financial" | "browse";

export function PartyFeesWorkspace({
  variant,
  assigneeId,
  isSupervisor,
}: {
  variant: "field-inspection" | "engineering-survey" | "government-review";
  assigneeId?: string;
  isSupervisor: boolean;
}) {
  const [tab, setTab] = useState<PartyFeesTab>(
    isSupervisor ? "financial" : "fees",
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

  const showKeyReceiptFees =
    variant === "government-review" || isSupervisor;

  return (
    <div className="flex min-h-0 flex-col gap-3 px-4 py-4">
      {isSupervisor ? (
        <TabBar className="mb-3">
          <Tab active={tab === "financial"} onClick={() => setTab("financial")}>
            الأمور المالية
            {supReviewRows.length + returnedToSup.length > 0
              ? ` (${supReviewRows.length + returnedToSup.length})`
              : ""}
          </Tab>
          <Tab active={tab === "fees"} onClick={() => setTab("fees")}>
            الحسم والمراجعة
          </Tab>
          <Tab active={tab === "key-fees"} onClick={() => setTab("key-fees")}>
            أتعاب المفاتيح
          </Tab>
        </TabBar>
      ) : (
        <TabBar className="mb-3">
          <Tab active={tab === "browse"} onClick={() => setTab("browse")}>
            عقاراتي وحالاتها
          </Tab>
          <Tab active={tab === "fees"} onClick={() => setTab("fees")}>
            أتعاب المعاملة
          </Tab>
          {showKeyReceiptFees ? (
            <Tab active={tab === "key-fees"} onClick={() => setTab("key-fees")}>
              أتعاب المفاتيح
            </Tab>
          ) : null}
          <Tab active={tab === "disburse"} onClick={() => setTab("disburse")}>
            طلب صرف
          </Tab>
          <Tab active={tab === "returned"} onClick={() => setTab("returned")}>
            المُعاد لي
          </Tab>
        </TabBar>
      )}

      <TabPanel>
        {tab === "fees" ? (
          isSupervisor ? (
            <>
              <InspectorFeesBillingTable
                rows={rows}
                mode="supervisor"
                pending={isLoading && !isFetched}
              />
              <QueueTableHint className="mt-3">
                الحسم هنا — الاعتماد والإرسال للمالية من تبويب «الأمور المالية».
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
              </QueueTableHint>
            </>
          )
        ) : null}

        {tab === "key-fees" && showKeyReceiptFees ? (
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
              أتعاب استلام ظرف المفاتيح (سيناريو المحكمة). التفاصيل الكاملة من{" "}
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

        {tab === "disburse" && !isSupervisor ? (
          <PartyDisbursementRequest
            rows={rows.filter((r) => r.canCreateDisbursementRequest)}
          />
        ) : null}

        {tab === "returned" && !isSupervisor ? (
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
