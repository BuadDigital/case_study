"use client";

/**
 * The key-envelope detail screen. Composition only: `useKeyEnvelopeDetailWorkflow`
 * owns loading and commands, `KeyEnvelopeDetailPanels` renders the four tabs,
 * `KeyEnvelopeDetailDialogs` renders the modals, and this file draws the header
 * and wires the pieces together.
 */
import { cn, opsBtnPrimary, opsPpHeadCard } from "@platform/ui-kit";
import {
  envelopeDisplayRef,
  envelopeStatusColor,
  envelopeStatusLabel,
  scenarioColor,
  scenarioLabel,
} from "../lib/keys-envelope-types";
import { KeyEnvelopeAttachmentPreview } from "./KeyEnvelopeAttachmentPreview";
import {
  KeysBackLink,
  KeysPpCell,
  KeysStatusPill,
  KeysTabBar,
} from "./KeysHtmlPrimitives";
import { AlertIcon, EnvIcon, PhoneIcon } from "./KeyEnvelopeDetailIcons";
import {
  AssignmentsPanel,
  CourtAccessPanel,
  CustodyPanel,
  TimelinePanel,
} from "./KeyEnvelopeDetailPanels";
import {
  CourtAccessModal,
  DeliverEnvelopeModal,
  MatchResultModal,
  ReceiveEnvelopeModal,
} from "./KeyEnvelopeDetailDialogs";
import {
  displayPersonName,
  envelopeHasAttachments,
  formatDate,
  handoffButtonLabel,
  type DetailTab,
} from "./key-envelope-detail-state";
import { useKeyEnvelopeDetailWorkflow } from "./useKeyEnvelopeDetailWorkflow";

export function KeyEnvelopeDetailPage({
  envelopeId,
  canEdit,
  onBack,
  onChanged,
  backLabel = "محفظة المفاتيح",
}: {
  envelopeId: string;
  canEdit: boolean;
  onBack: () => void;
  onChanged: () => void;
  backLabel?: string;
}) {
  const {
    env,
    loading,
    tab,
    setTab,
    setBusy,
    commandBusy,
    matchTarget,
    setMatchTarget,
    handoffOpen,
    setHandoffOpen,
    courtAccess,
    courtEditTarget,
    setCourtEditTarget,
    fieldInspectors,
    staffLoadError,
    sortedAssignments,
    handleConfirmAssignment,
    handleConfirmHandoff,
    handleCourtAccessSaved,
    handleHandoffDone,
  } = useKeyEnvelopeDetailWorkflow({ envelopeId, onBack, onChanged });

  const stColor = env ? envelopeStatusColor(env.status) : "#8a8d96";
  const scColor = env ? scenarioColor(env.receiveScenario) : "#8a8d96";
  const handoffBtnLabel = handoffButtonLabel(env);
  const hasAttachments = envelopeHasAttachments(env);

  return (
    <>
      <KeysBackLink onClick={onBack}>{backLabel}</KeysBackLink>

      {loading || !env ? (
        <div className={cn(opsPpHeadCard, "py-8 text-sm text-text-3")}>
          جاري التحميل…
        </div>
      ) : (
        <>
          {/* pp-head — renderKeyDetail */}
          <div className={cn(opsPpHeadCard, "max-sm:px-4 max-sm:py-4")}>
            <div className="flex flex-wrap items-start justify-between gap-[18px]">
              <div className="flex min-w-0 items-center gap-[15px]">
                <span className="grid size-[50px] shrink-0 place-items-center rounded-[13px] bg-gold-soft text-gold-d max-sm:size-11">
                  <EnvIcon />
                </span>
                <div className="min-w-0">
                  <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading max-sm:text-[16px]">
                    <span
                      className="text-[19px] font-bold text-gold-d max-sm:text-[17px]"
                      dir="ltr"
                    >
                      {envelopeDisplayRef(env.id, env.createdAtUtc, env.referenceNumber)}
                    </span>
                    <span className="text-[13px] font-semibold text-text-3">
                      طلب {env.requestNumber}
                    </span>
                    <KeysStatusPill
                      label={envelopeStatusLabel(env.status)}
                      color={stColor}
                    />
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[12.5px] text-text-2">
                    <span>{env.court || "—"}</span>
                    <span className="text-text-3">·</span>
                    <span>{env.circuit || "—"}</span>
                  </div>
                </div>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className={cn(
                    opsBtnPrimary,
                    "h-[38px] w-full justify-center px-[13px] sm:w-auto",
                  )}
                  onClick={() => setHandoffOpen(true)}
                >
                  <EnvIcon size={15} />
                  <span>{handoffBtnLabel}</span>
                </button>
              ) : null}
            </div>

            {env.countMismatch ? (
              <div
                className="mt-3.5 flex items-center gap-[11px] rounded-[10px] px-[22px] py-3 text-[12.5px] font-semibold leading-relaxed"
                style={{
                  background: "color-mix(in srgb, #d9694f 9%, transparent)",
                  color: "#a32d2d",
                }}
              >
                <AlertIcon />
                <span>
                  تعارض في العدد: المكتوب على الظرف {env.keysCountLabeled}{" "}
                  والفعلي بعد العد {env.keysCountActual}. يلزم تعديل خطاب
                  الاستلام في المحكمة.
                </span>
              </div>
            ) : null}

            {/* pp-summary */}
            <div className="mt-4 flex flex-wrap border-t border-border pt-3.5 max-lg:grid max-lg:grid-cols-2 max-lg:gap-y-1">
              <KeysPpCell label="سيناريو الاستلام" first>
                <KeysStatusPill
                  label={scenarioLabel(env.receiveScenario)}
                  color={scColor}
                />
              </KeysPpCell>
              <KeysPpCell label="مستلم الظرف">
                {displayPersonName(env.createdByName)}
              </KeysPpCell>
              <KeysPpCell label="عدد المفاتيح">
                <span className="tabular-nums">{env.keysCountActual}</span>
              </KeysPpCell>
              <KeysPpCell label="الصكوك المرتبطة بالطلب">
                <span className="tabular-nums">{env.assignments.length}</span>
              </KeysPpCell>
              <KeysPpCell label="تاريخ التسجيل">
                <span dir="ltr">{formatDate(env.createdAtUtc)}</span>
              </KeysPpCell>
            </div>

            {hasAttachments ? (
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-3.5">
                <span className="text-[12px] font-semibold text-text-3">
                  المرفقات:
                </span>
                {env.receiptAttachmentId ? (
                  <KeyEnvelopeAttachmentPreview
                    attachmentId={env.receiptAttachmentId}
                    label="خطاب الاستلام"
                    variant="chip"
                    attKind="receipt"
                  />
                ) : null}
                {env.photoAttachmentId ? (
                  <KeyEnvelopeAttachmentPreview
                    attachmentId={env.photoAttachmentId}
                    label="صورة الظرف"
                    variant="chip"
                    attKind="photo"
                  />
                ) : null}
                {env.thirdPartyLetterAttachmentId ? (
                  <KeyEnvelopeAttachmentPreview
                    attachmentId={env.thirdPartyLetterAttachmentId}
                    label="خطاب الطرف الثالث"
                    variant="chip"
                    attKind="letter"
                  />
                ) : null}
                {env.contactPhones ? (
                  <span className="inline-flex items-center gap-[7px] rounded-lg border border-border-md bg-surface-2 px-[11px] py-1.5 text-[12px] font-semibold text-text-2">
                    <PhoneIcon />
                    <span dir="ltr">{env.contactPhones}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* HTML renderKeyDetail tabs: assignment + custody; timeline/court kept for live APIs */}
          <KeysTabBar
            tabs={[
              {
                id: "assign",
                label: "إسناد الصكوك",
                count: env.assignments.length,
              },
              {
                id: "custody",
                label: "سلسلة العهدة",
                count: env.handoffs.length + 1,
              },
              {
                id: "timeline",
                label: "سجل الحركات",
                count: env.timeline.length,
              },
              {
                id: "court",
                label: "التمكين / محظر الإخلاء",
                count: env.linkedProperties.length,
              },
            ]}
            active={tab}
            onChange={(id) => setTab(id as DetailTab)}
          />

          {tab === "assign" ? (
            <AssignmentsPanel
              env={env}
              rows={sortedAssignments}
              canEdit={canEdit}
              busy={commandBusy}
              onMatch={(a) => setMatchTarget(a)}
            />
          ) : null}
          {tab === "custody" ? (
            <CustodyPanel
              env={env}
              canEdit={canEdit}
              busy={commandBusy}
              onConfirm={(id) => void handleConfirmHandoff(id)}
            />
          ) : null}
          {tab === "timeline" ? <TimelinePanel env={env} /> : null}
          {tab === "court" ? (
            <CourtAccessPanel
              env={env}
              rows={courtAccess}
              canEdit={canEdit}
              onEdit={(p) => setCourtEditTarget(p)}
            />
          ) : null}
        </>
      )}

      {matchTarget && env ? (
        <MatchResultModal
          deed={matchTarget.deedNumber}
          busy={commandBusy}
          onClose={() => setMatchTarget(null)}
          onSave={(status, note) =>
            void handleConfirmAssignment(matchTarget.id, status, note)
          }
        />
      ) : null}

      {handoffOpen && env ? (
        env.status === "reviewer" ? (
          <DeliverEnvelopeModal
            env={env}
            inspectors={fieldInspectors}
            staffLoadError={staffLoadError}
            busy={commandBusy}
            onClose={() => setHandoffOpen(false)}
            onBusy={setBusy}
            onDone={handleHandoffDone}
          />
        ) : (
          <ReceiveEnvelopeModal
            env={env}
            busy={commandBusy}
            onClose={() => setHandoffOpen(false)}
            onBusy={setBusy}
            onDone={handleHandoffDone}
          />
        )
      ) : null}

      {courtEditTarget ? (
        <CourtAccessModal
          property={courtEditTarget}
          current={courtAccess.find(
            (r) => r.propertyId === courtEditTarget.propertyId,
          )}
          onClose={() => setCourtEditTarget(null)}
          onSaved={handleCourtAccessSaved}
        />
      ) : null}
    </>
  );
}
