"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { receiveTransaction } from "@platform/api-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { requireWorkOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useTransactionByPropertyQuery } from "@platform/app-shared/query/transaction-by-property-query";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import { Button, Note, cn, opsPanelCard, useToast } from "@platform/ui-kit";
import { canFormallyReceive } from "../../lib/app-data/po-roles";
import { formatDateAr } from "../../lib/app-data/po-intake-data";
import { beatTransactionWork, workMarkerLine } from "../../lib/app-data/transaction-work-marker";

/**
 * The property rail's coordination card (ruling 2026-11-02): «إرسال المعاملة للدراسة» while the
 * transaction waits for it, «أُرسلت للدراسة …» after, and «يعمل عليها الآن: فلان» for everyone. Opening
 * the page as a case specialist sends the «يعمل عليها الآن» heartbeat.
 *
 * How it works: reads the deed's transaction (receipt + marker); the receive button is offered to
 * coordination only while the study phase has started and nothing was received; a refusal shows
 * the server's reasons (which party has not delivered). Edge cases: a deed with no transaction
 * renders nothing; the button is hidden before distribution (`inCaseStudyPhase` false).
 */
export function PropertyDetailReceiptCard({
  propertyId,
  inCaseStudyPhase,
  withAction = true,
}: {
  propertyId: string;
  inCaseStudyPhase: boolean;
  /**
   * The send button — the coordinator's page only (Omar 2026-11-08: the property details page becomes a
   * page to view, so it keeps the card's state lines without the action).
   */
  withAction?: boolean;
}) {
  const { access, viewerUserId } = useAppAccess();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const query = useTransactionByPropertyQuery(propertyId);
  const transaction = query.data;
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const transactionId = transaction?.id ?? null;
  const isSpecialist = access.role === "case-specialist";
  useEffect(() => {
    if (isSpecialist) beatTransactionWork(transactionId);
  }, [isSpecialist, transactionId]);

  const marker = useMemo(
    () => (transaction ? workMarkerLine(transaction, viewerUserId) : null),
    [transaction, viewerUserId],
  );

  if (!transaction) return null;
  const received = Boolean(transaction.receivedAtUtc);
  const mayReceive = withAction && canFormallyReceive(access) && inCaseStudyPhase && !received;
  if (!mayReceive && !received && !marker) return null;

  async function receive() {
    if (busy) return;
    setBusy(true);
    setRefusal(null);
    try {
      const result = await receiveTransaction(requireWorkOrdersApiConfig(), propertyId);
      if (!result.ok) {
        setRefusal(("message" in result && result.message) || "تعذّر الإرسال — أعد المحاولة.");
        return;
      }
      showToast("أُرسلت المعاملة للدراسة", "success");
      await queryClient.invalidateQueries({ queryKey: appDataKeys.transactionByProperty(propertyId) });
      notifyTasksChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn(opsPanelCard, "flex flex-col gap-2 p-3")}>
      <p className="m-0 text-xs font-semibold text-heading">الإرسال للدراسة</p>
      {received ? (
        <p className="m-0 text-[11px] text-text-2">
          أُرسلت للدراسة {transaction.receivedAtUtc ? `بتاريخ ${formatDateAr(transaction.receivedAtUtc)}` : ""}
          {transaction.receivedByName ? ` — ${transaction.receivedByName}` : ""}
        </p>
      ) : mayReceive ? (
        <>
          <p className="m-0 text-[11px] text-text-2">
            استلم عمل كل طرف، وتأكد من الأطراف الخارجية والمهام المرتبطة، ثم أرسل المعاملة للدراسة.
          </p>
          {refusal ? (
            <Note tone="danger" className="text-[11px]">
              {refusal}
            </Note>
          ) : null}
          <Button type="button" variant="primary" size="sm" loading={busy} disabled={busy} onClick={() => void receive()}>
            {busy ? "جاري الإرسال…" : "إرسال المعاملة للدراسة"}
          </Button>
        </>
      ) : null}
      {marker ? <p className="m-0 text-[11px] text-text-3">{marker}</p> : null}
    </section>
  );
}
