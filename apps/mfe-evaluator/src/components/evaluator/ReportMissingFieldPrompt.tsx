"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getOrganizationSettingsSectionEditors,
  getWorkOrderFieldSources,
  notifyIntakeFieldGap,
  notifyOrganizationSettingsGap,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { Button, Spinner, useToast } from "@platform/ui-kit";
import {
  cellsForMissingKey,
  missingCellKey,
  readMissingCell,
  type ReportAppraiserTab,
  type ReportMissingCell,
} from "../../lib/evaluator/valuation-report-missing-fields";
import {
  missingFieldNoResponsibleText,
  missingFieldNotifiedToast,
  missingFieldNotifyError,
  missingFieldPromptText,
  responsibleForMissingCell,
} from "../../lib/evaluator/valuation-report-missing-field-prompt";

const OPEN_ATTR = "data-rpt-missing-open";
const NOTIFIED_ATTR = "data-rpt-missing-notified";
const PANEL_WIDTH = 300;
const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 6;

type OpenPrompt = { element: HTMLElement; cell: ReportMissingCell };

/** Fixed position under the cell (above when there is no room), kept inside the viewport. */
function panelStyle(anchor: HTMLElement, panel: HTMLElement | null): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, vw - VIEWPORT_MARGIN * 2);
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.right - width, vw - width - VIEWPORT_MARGIN),
  );
  const height = panel?.offsetHeight ?? 0;
  let top = rect.bottom + PANEL_GAP;
  if (height > 0 && top + height > vh - VIEWPORT_MARGIN) {
    const above = rect.top - height - PANEL_GAP;
    if (above >= VIEWPORT_MARGIN) top = above;
  }
  return { position: "fixed", top, left, width, zIndex: 1200 };
}

/**
 * Red cells in the report preview are the controls: a click on the appraiser's own field opens
 * the tab that completes it; any other source opens a small prompt naming the person who
 * supplies the information, and sends them a notification on confirm.
 */
export function ReportMissingFieldPrompt({
  rootRef,
  html,
  poNumber,
  propertyId,
  onNavigateTab,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  html: string;
  poNumber: string;
  propertyId: string;
  onNavigateTab?: (tab: ReportAppraiserTab) => void;
}) {
  const [open, setOpen] = useState<OpenPrompt | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [sending, setSending] = useState(false);
  const [notified, setNotified] = useState<ReadonlySet<string>>(() => new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const po = poNumber.trim();
  const pid = propertyId.trim();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const hit = readMissingCell(event.target);
      if (!hit) return;
      event.preventDefault();
      if (hit.cell.source === "appraiser") {
        setOpen(null);
        if (hit.cell.tab) onNavigateTab?.(hit.cell.tab);
        return;
      }
      setOpen((prev) => (prev?.element === hit.element ? null : hit));
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [rootRef, onNavigateTab, html]);

  // A rebuilt report replaces every cell: re-apply «notified», drop a prompt whose cell is gone.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const key of notified) {
      for (const el of cellsForMissingKey(root, key)) el.setAttribute(NOTIFIED_ATTR, "1");
    }
    setOpen((prev) => (prev && !root.contains(prev.element) ? null : prev));
  }, [html, notified, rootRef]);

  useEffect(() => {
    if (!open) return;
    const cell = open.element;
    cell.setAttribute(OPEN_ATTR, "1");
    return () => cell.removeAttribute(OPEN_ATTR);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: "hidden" });
      return;
    }
    const place = () => setStyle(panelStyle(open.element, panelRef.current));
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || open.element.contains(target)) return;
      setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const forOrg = open?.cell.source === "org";
  const sourcesQuery = useQuery({
    queryKey: ["report-field-sources", po, pid],
    enabled: open != null && !forOrg && Boolean(po && pid),
    staleTime: 60_000,
    queryFn: async () => {
      const config = apiConfig();
      if (!config) throw new Error("auth");
      const res = await getWorkOrderFieldSources(config, po, pid);
      if (!res.ok) throw new Error(res.kind);
      return res.data;
    },
  });
  const editorsQuery = useQuery({
    queryKey: ["organization-settings-section-editors"],
    enabled: forOrg,
    staleTime: 60_000,
    queryFn: async () => {
      const config = apiConfig();
      if (!config) throw new Error("auth");
      const res = await getOrganizationSettingsSectionEditors(config);
      if (!res.ok) throw new Error(res.kind);
      return res.data;
    },
  });

  const responsible = open
    ? responsibleForMissingCell(open.cell, sourcesQuery.data, editorsQuery.data)
    : null;
  const activeQuery = forOrg ? editorsQuery : sourcesQuery;
  const missingContext = open != null && !forOrg && !(po && pid);
  const loadFailed = responsible == null && activeQuery.isError;

  const send = useCallback(async () => {
    if (!open || !responsible?.canNotify) return;
    const config = apiConfig();
    if (!config) {
      showToast(missingFieldNotifyError({ kind: "auth" }), "error");
      return;
    }
    const { cell } = open;
    const fieldKey = cell.label.slice(0, 64);
    setSending(true);
    const res =
      cell.source === "org" && cell.section
        ? await notifyOrganizationSettingsGap(config, {
            section: cell.section,
            fieldLabel: cell.label,
            fieldKey,
            poNumber: po || undefined,
          })
        : await notifyIntakeFieldGap(config, po, pid, {
            fieldLabel: cell.label,
            fieldKey,
            source: cell.source === "inspector" || cell.source === "survey" ? cell.source : "intake",
          });
    setSending(false);
    if (!res.ok) {
      showToast(missingFieldNotifyError(res), "error");
      return;
    }
    showToast(
      missingFieldNotifiedToast(
        cell,
        res.data.recipientName,
        responsible.name || responsible.roleLabel,
      ),
      "success",
    );
    setNotified((prev) => new Set(prev).add(missingCellKey(cell)));
    setOpen(null);
  }, [open, responsible, po, pid, showToast]);

  if (!open || typeof document === "undefined") return null;
  const alreadyNotified = notified.has(missingCellKey(open.cell));

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="إشعار بنقص معلومة في التقرير"
      dir="rtl"
      data-no-action-toast
      data-testid="report-missing-prompt"
      style={style}
      className="rounded-[11px] border border-border-md bg-surface p-3 text-[12.5px] leading-relaxed text-text shadow-[0_12px_30px_-8px_rgba(18,40,76,0.3)]"
    >
      {missingContext ? (
        <p className="m-0 text-danger-text">
          تعذّر تحديد أمر العمل أو العقار لإرسال الإشعار.
        </p>
      ) : loadFailed ? (
        <p className="m-0 text-danger-text">
          تعذّر تحديد المسؤول عن هذه المعلومة — أعد المحاولة.
        </p>
      ) : responsible == null ? (
        <div className="flex items-center gap-2 text-text-3">
          <Spinner className="size-3.5" />
          <span>جاري تحديد المسؤول…</span>
        </div>
      ) : responsible.canNotify ? (
        <>
          <p className="m-0">{missingFieldPromptText(open.cell, responsible)}</p>
          {alreadyNotified ? (
            <p className="m-0 mt-1 text-[11px] text-text-3">
              سبق إرسال إشعار بهذا النقص.
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sending}
              onClick={() => setOpen(null)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={sending}
              onClick={() => void send()}
            >
              {sending ? "جاري الإرسال…" : "إرسال"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0">{missingFieldNoResponsibleText(open.cell)}</p>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(null)}
            >
              إغلاق
            </Button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
