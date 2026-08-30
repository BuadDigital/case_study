"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Button, cn } from "@platform/ui-kit";
import { FailureRaisePanel } from "@failures/mfe/components/failures/FailureRaisePanel";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import {
  FieldInspectionWorkBody,
  type FieldInspectionWorkHostRef,
} from "./FieldInspectionWorkBody";

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Case Study.html `renderInspectMobile`:
 * ink header + scroll progress + accordion body + sticky "save and submit inspection".
 * No key/fees tab strip — failure opens as a secondary panel only.
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
  const [showFailure, setShowFailure] = useState(false);

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
  }, [onScroll, showFailure]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [showFailure]);

  /* iOS PWA / Safari: draw under status bar with dark chrome while this shell is open. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const metaStatus =
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') ??
      (() => {
        const m = document.createElement("meta");
        m.setAttribute("name", "apple-mobile-web-app-status-bar-style");
        document.head.appendChild(m);
        return m;
      })();
    const metaTheme =
      document.querySelector('meta[name="theme-color"]') ??
      (() => {
        const m = document.createElement("meta");
        m.setAttribute("name", "theme-color");
        document.head.appendChild(m);
        return m;
      })();

    const prevStatus = metaStatus.getAttribute("content");
    const prevTheme = metaTheme.getAttribute("content");
    metaStatus.setAttribute("content", "black-translucent");
    metaTheme.setAttribute("content", "#102b4e");

    return () => {
      if (prevStatus != null) metaStatus.setAttribute("content", prevStatus);
      else metaStatus.setAttribute("content", "default");
      if (prevTheme != null) metaTheme.setAttribute("content", prevTheme);
      else metaTheme.setAttribute("content", "#102b4e");
    };
  }, []);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg)]",
        /* Edge-to-edge on phones (iPhone / Samsung): escape shell gutters & paint under status bar. */
        "max-lg:fixed max-lg:inset-0 max-lg:z-[55]",
      )}
    >
      <header className="shrink-0 bg-ink px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={showFailure ? "رجوع للنموذج" : "إغلاق"}
            className="grid size-[38px] shrink-0 place-items-center rounded-[11px] border-none bg-white/14 text-white"
            onClick={() => {
              if (showFailure) {
                setShowFailure(false);
                return;
              }
              onClose();
            }}
          >
            <IconClose />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold leading-tight">
              {showFailure ? "تسجيل تعذر" : "معاينة ميدانية"}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[var(--gold-2,#c8b591)]">
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
        {!showFailure ? (
          <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-white/16">
            <div
              className="h-full rounded-full bg-[var(--gold-2,#c8b591)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        onScroll={!showFailure ? onScroll : undefined}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--bg)] [-webkit-overflow-scrolling:touch]",
          showFailure && "pb-[env(safe-area-inset-bottom,0px)]",
        )}
      >
        {showFailure && task.propertyId ? (
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
                setShowFailure(false);
              }}
            />
          </div>
        ) : (
          <FieldInspectionWorkBody
            def={def}
            task={task}
            hostRef={hostRef}
            submitting={submitting}
            layout="mobile"
            hideSubmitFooter
            onRegisterFailure={() => setShowFailure(true)}
          />
        )}
      </div>

      {!showFailure ? (
        <div className="flex shrink-0 border-t border-border bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <Button
            type="button"
            variant="primary"
            className={cn(
              "min-h-[52px] flex-1 rounded-[14px] border-none text-[16px] font-extrabold",
              "shadow-[0_8px_20px_-6px_rgba(16,43,78,0.5)]",
            )}
            loading={submitting}
            showActionToast={false}
            actionLabel="حفظ وإرسال المعاينة"
            onClick={() => void hostRef.current?.submit?.()}
          >
            حفظ وإرسال المعاينة
          </Button>
        </div>
      ) : null}
    </div>
  );
}
