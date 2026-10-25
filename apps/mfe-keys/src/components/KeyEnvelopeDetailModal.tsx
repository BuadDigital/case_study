"use client";

/**
 * The key-envelope detail screen. Composition only: `useKeyEnvelopeDetailWorkflow`
 * owns loading and commands, `KeyEnvelopeDetailPanels` renders the four tabs,
 * the `KeyEnvelope*Dialog` files render the modals, and this file draws the
 * header and wires the pieces together.
 */
import { useRef } from "react";
import {
  cn,
  GentleBusy,
  opsBtnPrimary,
  opsPpHeadCard,
  useSwapAnimation,
  ColorStatusPill,
} from "@platform/ui-kit";
import {
  envelopeDisplayRef,
  envelopeHolderText,
  envelopeStatusColor,
  envelopeStatusLabel,
  otherKeysInEnvelope,
  scenarioColor,
  scenarioLabel,
} from "../lib/keys-envelope-types";
import { KeyEnvelopeAttachmentPreview } from "./KeyEnvelopeAttachmentPreview";
import {
  KeysBackLink,
  KeysPpCell,
  KeysTabBar,
} from "./KeysHtmlPrimitives";
import { AlertIcon, EnvIcon, PhoneIcon } from "./KeyEnvelopeDetailIcons";
import {
  AssignmentsPanel,
  CourtAccessPanel,
  CustodyPanel,
  TimelinePanel,
} from "./KeyEnvelopeDetailPanels";
import { CourtAccessModal } from "./KeyEnvelopeCourtAccessDialog";
import { DeliverEnvelopeModal } from "./KeyEnvelopeDeliverDialog";
import { MatchResultModal } from "./KeyEnvelopeMatchResultDialog";
import { ReceiveEnvelopeModal } from "./KeyEnvelopeReceiveDialog";
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
    handleSetKeyLocation,
    handleConfirmHandoff,
    handleCourtAccessSaved,
    handleHandoffDone,
  } = useKeyEnvelopeDetailWorkflow({ envelopeId, onBack, onChanged });
  const tabPanelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(tabPanelRef, tab);

  const stColor = env ? envelopeStatusColor(env.status) : "#8a8d96";
  const scColor = env ? scenarioColor(env.receiveScenario) : "#8a8d96";
  const handoffBtnLabel = handoffButtonLabel(env);
  const hasAttachments = envelopeHasAttachments(env);

  return (
    <>
      <KeysBackLink onClick={onBack}>{backLabel}</KeysBackLink>

      {loading || !env ? (
        <div className={cn(opsPpHeadCard, "py-8 text-sm text-text-3")} aria-busy>
          <GentleBusy>جاري التحميل…</GentleBusy>
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
                    <ColorStatusPill
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

            {env.readyForCourtReturn && env.status === "reviewer" ? (
              <div
                className="mt-3.5 flex items-center gap-[11px] rounded-[10px] px-[22px] py-3 text-[12.5px] font-semibold leading-relaxed"
                style={{
                  background: "color-mix(in srgb, #2f7a4d 10%, transparent)",
                  color: "#2f7a4d",
                }}
              >
                <span>
                  جُرِّبت كل صكوكنا وعادت مفاتيحها المطابقة — الظرف جاهز
                  للإرجاع إلى المحكمة.
                </span>
              </div>
            ) : null}

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
                <ColorStatusPill
                  label={scenarioLabel(env.receiveScenario)}
                  color={scColor}
                />
              </KeysPpCell>
              <KeysPpCell label="مستلم الظرف">
                {displayPersonName(env.createdByName)}
              </KeysPpCell>
              <KeysPpCell label="عند من الآن">
                {envelopeHolderText(env)}
              </KeysPpCell>
              <KeysPpCell label="عدد المفاتيح">
                <span className="tabular-nums">{env.keysCountActual}</span>
                {otherKeysInEnvelope(env) > 0 ? (
                  <span className="ms-1 text-[11px] text-text-3">
                    (منها {otherKeysInEnvelope(env)} لا تخص صكوكنا)
                  </span>
                ) : null}
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
                label: "التمكين / محضر الإخلاء",
                count: env.linkedProperties.length,
              },
            ]}
            active={tab}
            onChange={(id) => setTab(id as DetailTab)}
          />

          <div ref={tabPanelRef}>
            {tab === "assign" ? (
              <AssignmentsPanel
                env={env}
                rows={sortedAssignments}
                canEdit={canEdit}
                busy={commandBusy}
                inspectors={fieldInspectors}
                onMatch={(a) => setMatchTarget(a)}
                onSetKeyLocation={(a, loc, holder) =>
                  void handleSetKeyLocation(a.id, loc, holder)
                }
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
          </div>
        </>
      )}

      {matchTarget && env ? (
        <MatchResultModal
          deed={matchTarget.deedNumber}
          busy={commandBusy}
          onClose={() => setMatchTarget(null)}
          onSave={(status, note, keyLocation) =>
            void handleConfirmAssignment(
              matchTarget.id,
              status,
              note,
              keyLocation,
            )
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
