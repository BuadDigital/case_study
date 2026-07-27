"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Button, cn } from "@platform/design-system";
import { FailureRaisePanel } from "@failures/mfe";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import {
  FieldInspectionWorkBody,
  type FieldInspectionWorkHostRef,
} from "./FieldInspectionWorkBody";
import { InspectorKeyStatusTab } from "./InspectorKeyStatusTab";
import { InspectorFeesTab } from "./InspectorFeesTab";

type MobileTab = "inspection" | "key" | "fees" | "failures";

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 2l-2 2m-7.6 7.6a5 5 0 1 1-2.8-2.8L15 4h3v3l-4.6 4.6" />
      <circle cx="7.5" cy="16.5" r="1" />
    </svg>
  );
}

function IconCoin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5s-2 .6-2.5 1.5S9 11.5 12 12s3 1 2.5 2-.9 1.5-2.5 1.5-2-.5-2.5-1.5" />
    </svg>
  );
}

const TABS: {
  id: MobileTab;
  label: string;
  icon: () => ReactNode;
}[] = [
  { id: "inspection", label: "المعاينة", icon: IconClipboard },
  { id: "key", label: "المفتاح", icon: IconKey },
  { id: "fees", label: "المالية", icon: IconCoin },
  { id: "failures", label: "تعذر", icon: IconAlert },
];

/**
 * Mobile / PWA shell matching Case Study.html `renderInspectMobile`:
 * ink header, scroll progress, numbered accordion body, sticky submit,
 * plus secondary access to key / fees / failures.
 */
export function FieldInspectionMobileShell({
  def,
  task,
  hostRef,
  deedLabel,
  locationLabel,
  submitting = false,
  onClose,
  onFailureSubmitted,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  deedLabel: string;
  locationLabel: string;
  submitting?: boolean;
  onClose: () => void;
  onFailureSubmitted?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(12);
  const [tab, setTab] = useState<MobileTab>("inspection");

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct =
      max <= 0
        ? 12
        : Math.max(12, Math.min(100, Math.round((el.scrollTop / max) * 100)));
    setProgress(pct);
  }, []);

  useEffect(() => {
    onScroll();
  }, [onScroll, tab]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  function openFailures() {
    setTab("failures");
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
      <header className="shrink-0 bg-ink px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="إغلاق"
            className="grid size-[38px] shrink-0 place-items-center rounded-[11px] border-none bg-white/14 text-white"
            onClick={onClose}
          >
            <IconClose />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold leading-tight">
              معاينة ميدانية
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[var(--gold-2,#e8c56a)]">
              {deedLabel.trim() || locationLabel.trim() ? (
                <>
                  {deedLabel.trim() ? (
                    <>
                      صك <bdi dir="ltr">{deedLabel.trim()}</bdi>
                    </>
                  ) : null}
                  {deedLabel.trim() &&
                  locationLabel.trim() &&
                  locationLabel !== "—"
                    ? " · "
                    : null}
                  {locationLabel.trim() && locationLabel !== "—"
                    ? locationLabel.trim()
                    : null}
                </>
              ) : (
                "بيانات لم تُسجَّل بعد…"
              )}
            </div>
          </div>
        </div>
        {tab === "inspection" ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/16">
            <div
              className="h-full rounded-full bg-[var(--gold-2,#e8c56a)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <div className="mt-3 h-1.5" aria-hidden />
        )}
        <nav
          className="mt-1 flex gap-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:h-0"
          aria-label="أقسام المعاينة"
        >
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 bg-transparent px-3 py-2 font-inherit text-[12px] transition-colors",
                  on
                    ? "border-[var(--gold-2,#e8c56a)] font-bold text-white"
                    : "border-transparent font-medium text-white/55",
                )}
                onClick={() => setTab(t.id)}
              >
                <span className="opacity-90">{t.icon()}</span>
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div
        ref={scrollRef}
        onScroll={tab === "inspection" ? onScroll : undefined}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        {tab === "inspection" ? (
          <FieldInspectionWorkBody
            def={def}
            task={task}
            hostRef={hostRef}
            submitting={submitting}
            layout="mobile"
            hideSubmitFooter
            onRegisterFailure={openFailures}
          />
        ) : null}
        {tab === "key" ? (
          <div className="p-4">
            <InspectorKeyStatusTab
              task={task}
              onRegisterKeyFailure={openFailures}
            />
          </div>
        ) : null}
        {tab === "fees" ? (
          <div className="p-3">
            <InspectorFeesTab tasks={[task]} variant="field-inspection" />
          </div>
        ) : null}
        {tab === "failures" && task.propertyId ? (
          <div id="inspector-failure-raise-mobile" className="scroll-mt-4 p-4">
            <FailureRaisePanel
              poNumber={task.poNumber}
              propertyId={task.propertyId}
              deedNumber={deedLabel}
              specialist={task.assigneeName || def.assigneeSubtitle}
              raisedByRole={failureRaiserRoleForParty(def)}
              autoOpenRaise
              onSubmitted={() => {
                onFailureSubmitted?.();
              }}
            />
          </div>
        ) : null}
      </div>

      {tab === "inspection" ? (
        <div className="flex shrink-0 gap-2.5 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="min-h-[52px] shrink-0 rounded-[14px] border-orange px-3 text-orange"
            disabled={submitting}
            showActionToast={false}
            aria-label="تسجيل تعذر"
            onClick={openFailures}
          >
            <IconAlert />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[52px] shrink-0 rounded-[14px] px-3"
            disabled={submitting}
            showActionToast={false}
            actionLabel="حفظ مسودة المعاينة"
            onClick={() => void hostRef.current?.saveDraft?.()}
          >
            مسودة
          </Button>
          <Button
            type="button"
            variant="primary"
            className={cn(
              "min-h-[52px] flex-1 rounded-[14px] text-[15px] font-extrabold",
              "shadow-[0_8px_20px_-6px_rgba(16,43,78,0.5)]",
            )}
            disabled={submitting}
            showActionToast={false}
            actionLabel="حفظ وإرسال المعاينة"
            onClick={() => void hostRef.current?.submit?.()}
          >
            {submitting ? "جاري الإرسال…" : "حفظ وإرسال"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
