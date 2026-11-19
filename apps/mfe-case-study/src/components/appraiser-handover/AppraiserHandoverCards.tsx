"use client";

/**
 * The appraiser's reassignment requests and peer transfers on screen (Omar 2026-11-18).
 *
 * - `AppraiserHandoverInbox` — the appraiser's own open requests (with «إلغاء الطلب») and the transfers
 *   waiting for his answer («قبول» / «اعتذار»), at the top of «أعمالي».
 * - `AppraiserHandoverStaffCard` — on the work page, the reassignment request of this deed for whoever
 *   may handle it: «استلام» then «نقل لمقيّم» with the eligible appraisers.
 * - `useAppraiserHandoverMenuItems` — the appraiser's row items «طلب إعادة إسناد» and «تحويل لمقيّم آخر».
 *
 * The server decides who may do what; refusals come back in Arabic and show as toasts.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptAppraiserPeerTransfer,
  cancelAppraiserHandoverRequest,
  completeAppraiserReassignment,
  declineAppraiserPeerTransfer,
  listAppraiserHandoverRequests,
  requestAppraiserPeerTransfer,
  requestAppraiserReassignment,
  takeAppraiserReassignment,
  type AppraiserHandoverRequestDto,
} from "@platform/api-client";
import {
  AppModal,
  Button,
  Card,
  CardBody,
  Note,
  promptAction,
  useToast,
  type RowMoreMenuItem,
} from "@platform/ui-kit";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import {
  mutationFromApiResult,
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { getValuators } from "../../lib/app-data/distribution-parties";
import type { WorkflowTask } from "../../lib/app-data/tasks";

const KEY = [...appDataKeys.all, "appraiser-handover-requests"] as const;

/** The open requests the caller sees — refreshed every minute (a request widens to the team after five). */
export function useAppraiserHandoverRequests(enabled = true) {
  return useQuery<AppraiserHandoverRequestDto[]>({
    queryKey: KEY,
    queryFn: async () =>
      unwrapApiResult(await listAppraiserHandoverRequests(requireWorkOrdersApiConfig()), "تعذّر تحميل الطلبات"),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Runs one request command, toasts the outcome, and refreshes the lists and the task queues. */
function useHandoverCommand() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (
    call: () => Promise<Parameters<typeof mutationFromApiResult>[0]>,
    success: string,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const result = mutationFromApiResult(await call(), "تعذّر تنفيذ الطلب");
      if (!result.ok) {
        showToast(result.error, "error");
        return false;
      }
      showToast(success, "success");
      await queryClient.invalidateQueries({ queryKey: appDataKeys.all });
      return true;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

/** The eligible appraisers as select options (value = distribution id), the given one left out. */
function useAppraiserOptions(exceptAssigneeId?: string) {
  const { data } = useDistributionAssigneesQuery();
  return useMemo(
    () =>
      getValuators(data?.users ?? [])
        .filter((a) => a.id !== exceptAssigneeId)
        .map((a) => ({ value: a.id, label: a.name, name: a.name })),
    [data, exceptAssigneeId],
  );
}

function statusLine(r: AppraiserHandoverRequestDto): string {
  if (r.kind === "peer") {
    return r.direction === "offer"
      ? `بانتظار قبول ${r.peerName || "الزميل"}`
      : `بانتظار موافقة ${r.peerName || "الزميل"}`;
  }
  if (r.status === "taken") return `استلمه ${r.takenByName ?? ""}`.trim();
  return r.escalated ? "لم يُستلم بعد — عند فريق الأخصائيين" : "لم يُستلم بعد — عند من سلّمك المعاملة";
}

/**
 * The appraiser's open requests and the transfers waiting for him, at the top of «أعمالي».
 * Edge cases: nothing open → renders nothing.
 */
export function AppraiserHandoverInbox({ myAssigneeId }: { myAssigneeId: string }) {
  const { data = [] } = useAppraiserHandoverRequests(Boolean(myAssigneeId));
  const { run, busy } = useHandoverCommand();
  if (data.length === 0) return null;
  const config = () => requireWorkOrdersApiConfig();
  return (
    <Card className="mb-3" data-testid="appraiser-handover-inbox">
      <CardBody className="flex flex-col gap-2">
        <p className="m-0 text-[12px] font-bold text-heading">طلبات إعادة الإسناد والتحويل</p>
        {data.map((r) => {
          const waitsForMe = r.kind === "peer" && r.peerAssigneeId === myAssigneeId;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 text-[12px]">
                <span className="font-semibold">أمر العمل {r.poNumber}</span>
                {" — "}
                {waitsForMe
                  ? r.direction === "offer"
                    ? `يعرض ${r.requestedByName} تحويل تقييمه إليك`
                    : `يطلب ${r.requestedByName} تحويل تقييمك إليه`
                  : statusLine(r)}
                {r.reason ? <span className="text-text-3"> · {r.reason}</span> : null}
              </div>
              <div className="flex gap-1.5">
                {waitsForMe ? (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => void run(() => acceptAppraiserPeerTransfer(config(), r.id), "انتقل التقييم")}
                    >
                      قبول
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => declineAppraiserPeerTransfer(config(), r.id), "أُبلغ الزميل باعتذارك")}
                    >
                      اعتذار
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => cancelAppraiserHandoverRequest(config(), r.id), "أُلغي الطلب")}
                  >
                    إلغاء الطلب
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

/**
 * The deed's reassignment request on the work page, for whoever may handle it: «استلام», then the new
 * appraiser and «نقل لمقيّم». Edge cases: no open request for this deed → nothing.
 */
export function AppraiserHandoverStaffCard({ propertyId }: { propertyId: string }) {
  const { data = [] } = useAppraiserHandoverRequests(Boolean(propertyId));
  const request = data.find((r) => r.kind === "reassign" && r.propertyId === propertyId);
  const options = useAppraiserOptions(request?.requestedByAssigneeId);
  const [target, setTarget] = useState("");
  const { run, busy } = useHandoverCommand();
  if (!request) return null;
  const config = () => requireWorkOrdersApiConfig();
  const chosen = options.find((o) => o.value === target);
  return (
    <Note tone="warn" className="mb-3" data-testid="appraiser-handover-staff">
      <div className="flex flex-col gap-2">
        <span>
          يطلب المقيّم {request.requestedByName} إعادة إسناد التقييم: {request.reason} — {statusLine(request)}
        </span>
        <div className="flex flex-wrap items-end gap-2">
          {request.status === "pending" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void run(() => takeAppraiserReassignment(config(), request.id), "استلمت الطلب")}
            >
              استلام
            </Button>
          ) : null}
          <div className="min-w-[220px]">
            <RegSelect
              id="handover-new-appraiser"
              label="المقيّم الجديد"
              options={options}
              value={target}
              disabled={busy}
              onChange={setTarget}
            />
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={busy || !chosen}
            onClick={() =>
              void run(
                () =>
                  completeAppraiserReassignment(config(), request.id, {
                    newAssigneeId: chosen!.value,
                    newAssigneeName: chosen!.name,
                  }),
                "نُقل التقييم للمقيّم الجديد",
              )
            }
          >
            نقل لمقيّم
          </Button>
        </div>
      </div>
    </Note>
  );
}

/** «تحويل لمقيّم آخر» — the colleague and an optional reason; sent as an offer. */
function PeerTransferDialog({
  task,
  onClose,
}: {
  task: WorkflowTask;
  onClose: () => void;
}) {
  const options = useAppraiserOptions(task.assigneeId ?? undefined);
  const [peer, setPeer] = useState("");
  const [reason, setReason] = useState("");
  const { run, busy } = useHandoverCommand();
  const chosen = options.find((o) => o.value === peer);
  return (
    <AppModal
      open
      title="تحويل التقييم لمقيّم آخر"
      subtitle="ينتقل التقييم بعمله كما هو عند قبول الزميل، ويعتمده هو."
      onClose={onClose}
      maxWidthPx={480}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={busy || !chosen}
            onClick={() =>
              void (async () => {
                const ok = await run(
                  () =>
                    requestAppraiserPeerTransfer(requireWorkOrdersApiConfig(), {
                      appraisalTaskId: task.id,
                      direction: "offer",
                      peerAssigneeId: chosen!.value,
                      peerName: chosen!.name,
                      reason: reason.trim() || undefined,
                    }),
                  "أُرسل العرض للزميل",
                );
                if (ok) onClose();
              })()
            }
          >
            إرسال للزميل
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <RegSelect id="peer-appraiser" label="الزميل" options={options} value={peer} onChange={setPeer} />
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-semibold text-text-2">السبب (اختياري)</span>
          <textarea
            className="min-h-[70px] rounded-md border border-border p-2 text-[13px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
    </AppModal>
  );
}

/**
 * The appraiser's row items on his own appraisal task: «طلب إعادة إسناد» (a reason, to whoever handed
 * him the transaction) and «تحويل لمقيّم آخر» (a colleague who accepts). Hidden while a request is open
 * and once he approved the report (the draft state says so; the server refuses it too).
 */
export function useAppraiserHandoverMenuItems(enabled: boolean) {
  const { data = [] } = useAppraiserHandoverRequests(enabled);
  const { run } = useHandoverCommand();
  const [peerTask, setPeerTask] = useState<WorkflowTask | null>(null);
  const itemsFor = (task: WorkflowTask): RowMoreMenuItem[] => {
    if (!enabled) return [];
    if (task.kind !== "property-appraisal" || task.status === "cancelled") return [];
    if (data.some((r) => r.appraisalTaskId === task.id)) return [];
    const draft = getReportDraftState(task.propertyId);
    if (draft && (draft.status === "approved" || draft.reportStage !== "draft")) return [];
    return [
      {
        id: "request-reassignment",
        label: "طلب إعادة إسناد",
        onClick: () =>
          void (async () => {
            const reason = await promptAction({
              title: "طلب إعادة إسناد",
              label: "السبب (مثلاً: سأغيب غدًا) — يصل لمن سلّمك المعاملة",
              required: true,
              confirmLabel: "إرسال الطلب",
            });
            if (reason == null) return;
            await run(
              () =>
                requestAppraiserReassignment(requireWorkOrdersApiConfig(), {
                  appraisalTaskId: task.id,
                  reason,
                }),
              "أُرسل طلب إعادة الإسناد",
            );
          })(),
      },
      { id: "peer-transfer", label: "تحويل لمقيّم آخر", onClick: () => setPeerTask(task) },
    ];
  };
  const modal = peerTask ? <PeerTransferDialog task={peerTask} onClose={() => setPeerTask(null)} /> : null;
  return { itemsFor, modal };
}
