"use client";

import {
  InlineLoadingSkeleton,
  cn,
  opsBtnPrimary,
  opsFldControl,
  opsWorkspaceCard,
} from "@platform/ui-kit";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "@case-study/mfe/lib/app-data/tasks-storage";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import type { EngineeringSurveyWindowHostRefObject } from "../lib/engineering-survey-window-host";
import { EngineeringSurveyPropertySummary } from "./EngineeringSurveyPropertySummary";
import {
  ENG_STATUS_COLORS,
  EngField,
  EngInfo,
  EngSection,
  EngStatusPill,
  EngTabBar,
} from "./EngineeringSurveyHtmlPrimitives";
import { FailureRaisePanel } from "./EngineeringSurveyWorkParts";
import { EngineeringSurveyWorkBody } from "./EngineeringSurveyWorkBody";
import { useEngineeringSurveyCommands } from "./useEngineeringSurveyCommands";
import { useEngineeringSurveyData } from "./useEngineeringSurveyData";

/**
 * Engineering survey work panel — the tab shell around the survey body:
 * property summary, fees, transaction note and the failures panel, plus the
 * gate banners. State lives in `useEngineeringSurveyData` and writes in
 * `useEngineeringSurveyCommands`.
 */
export function EngineeringSurveyWorkPanel({
  def,
  childTask: task,
  hostRef,
  deedNumber,
  onFailureSubmitted,
  variant = "workspace",
  forceReadOnly = false,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
  hostRef: EngineeringSurveyWindowHostRefObject;
  deedNumber: string;
  onBack?: () => void;
  onFailureSubmitted?: () => void;
  variant?: "workspace" | "entry";
  forceReadOnly?: boolean;
}) {
  const data = useEngineeringSurveyData({
    childTask: task,
    hostRef,
    deedNumber,
    variant,
    forceReadOnly,
  });
  const commands = useEngineeringSurveyCommands(data);
  const workflow = { ...data, ...commands };
  const {
    viewOnly,
    propertyId,
    record,
    property,
    draft,
    localFields,
    documentaryGate,
    locked,
    formDisabled,
    notesEditable,
    activeFailureCount,
    feeForTask,
    workTab,
    onWorkTabChange,
    savedNote,
    noteDraft,
    setNoteDraft,
    saveNote,
    handleStartSurvey,
  } = workflow;

  if (!draft || !localFields) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

  const feeAmountLabel = feeForTask
    ? `${Number(feeForTask.netFeeSar ?? 0).toLocaleString("ar-SA")} ر.س`
    : "—";

  return (
    <>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className={opsWorkspaceCard}>
          <EngTabBar
            active={workTab}
            onChange={onWorkTabChange}
            tabs={[
              { id: "property", label: "بيانات العقار" },
              { id: "survey", label: "الرفع المساحي" },
              { id: "fees", label: "مالية المعاملة" },
              { id: "notes", label: "ملاحظة", dot: Boolean(savedNote) },
              {
                id: "failures",
                label: "التعذرات",
                badge: activeFailureCount,
              },
            ]}
          />

          {!documentaryGate.ready ? (
            <div className="mb-3.5 rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
              <strong>⚠ الرفع مجمّد ولا يُحتسب الوقت:</strong>{" "}
              {documentaryGate.reason}
            </div>
          ) : null}

          {viewOnly && documentaryGate.ready ? (
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
              <span>
                👁 وضع الاستعراض — جميع الحقول للقراءة فقط.
                {locked ? "" : " للتعديل ابدأ عملية الرفع."}
              </span>
              {!locked ? (
                <button
                  type="button"
                  className={cn(opsBtnPrimary, "!px-3.5 !py-1.5 !text-[11.5px]")}
                  onClick={handleStartSurvey}
                >
                  بدء الرفع المساحي
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              formDisabled &&
                workTab !== "property" &&
                workTab !== "fees" &&
                "pointer-events-none select-none opacity-75",
              locked &&
                workTab === "survey" &&
                "rounded-[10px] bg-[#F1F5F9] p-3 grayscale-[0.35]",
            )}
          >
            {workTab === "property" ? (
              <EngineeringSurveyPropertySummary
                property={property}
                record={record ?? undefined}
                deedNumber={deedNumber}
              />
            ) : null}

            {workTab === "survey" ? (
              <EngineeringSurveyWorkBody workflow={workflow} />
            ) : null}

            {workTab === "fees" ? (
              <>
                <EngSection>أتعاب الرفع المساحي</EngSection>
                <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <EngField label="قيمة الأتعاب" value={feeAmountLabel} />
                  <EngField label="حالة الاستحقاق">
                    {draft.status === "submitted" || locked ? (
                      <EngStatusPill
                        label="مستحقة بعد الإرسال"
                        color={ENG_STATUS_COLORS.submitted}
                      />
                    ) : (
                      <EngStatusPill
                        label="تُستحق عند إرسال الرفع"
                        color={ENG_STATUS_COLORS.pending}
                      />
                    )}
                  </EngField>
                  <EngField label="حالة الدفع">
                    <EngStatusPill
                      label={
                        feeForTask?.billingStatus === "disbursed"
                          ? "صُرفت"
                          : "لم تُصرف"
                      }
                      color={
                        feeForTask?.billingStatus === "disbursed"
                          ? ENG_STATUS_COLORS.submitted
                          : ENG_STATUS_COLORS.unpaid
                      }
                    />
                  </EngField>
                </div>
                <EngInfo>
                  تُستحق أتعاب الرفع المساحي للمكتب الهندسي عند إرسال المعاملة
                  واعتمادها من أخصائي دراسة الحالة.
                </EngInfo>
              </>
            ) : null}

            {workTab === "notes" ? (
              <>
                <EngSection>ملاحظة على المعاملة</EngSection>
                <textarea
                  id="eng-workspace-note"
                  className={cn(opsFldControl, "min-h-[120px] resize-y")}
                  rows={5}
                  disabled={!notesEditable}
                  value={noteDraft}
                  placeholder="اكتب ملاحظتك هنا…"
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                {notesEditable ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      className={cn(
                        opsBtnPrimary,
                        "!px-[18px] !py-[7px] !text-xs",
                      )}
                      onClick={saveNote}
                    >
                      حفظ الملاحظة
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-text-3">
                    {viewOnly
                      ? "وضع الاستعراض — لا يمكن التعديل."
                      : "لا يمكن تعديل الملاحظة بعد إرسال المعاملة أو إغلاقها."}
                  </p>
                )}
              </>
            ) : null}

            {workTab === "failures" && propertyId ? (
              <FailureRaisePanel
                poNumber={task.poNumber}
                propertyId={propertyId}
                deedNumber={deedNumber}
                specialist={task.assigneeName || def.assigneeSubtitle}
                raisedByRole={failureRaiserRoleForParty(def)}
                onSubmitted={onFailureSubmitted}
                autoOpenRaise={false}
                raiseDisabled={formDisabled}
                raiseDisabledReason={
                  viewOnly
                    ? "وضع الاستعراض — لا يمكن تسجيل تعذر من هنا."
                    : "لا يمكن تسجيل تعذر بعد إرسال المعاملة."
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
