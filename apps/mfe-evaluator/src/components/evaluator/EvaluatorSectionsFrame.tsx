"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { WorkSectionsLayout, useWorkSections } from "@platform/ui-kit";
import { WORK_SECTION_TOP_GAP } from "./EvaluatorHtmlPrimitives";
import type { ValuationWorkScreenParts } from "./valuation-work/ValuationWorkShell.types";
import type { ValuationWorkScreenId } from "./valuation-work/lib/shell-state";
import {
  EVALUATOR_KEEP_MOUNTED,
  evaluatorSections,
  evaluatorSectionsStep,
  type EvaluatorSectionId,
} from "./evaluator-window-tabs";

/** A request to bring one valuation screen into view; a new object asks again for the same screen. */
export type EvaluatorSectionFocus = { screen: ValuationWorkScreenId };

/**
 * The appraiser's page body: the work page's sections frame around the valuation screens
 * (Omar 2026-11-10 — numbered sections on a rail instead of the tab bar).
 *
 * How it works: the sections are the summary plus the screens of the approaches in use; the step
 * comes from the screen the valuation stands at (`parts.current`), so the rail marks what is done,
 * current and still ahead; the page opens with every section folded, like every page on the
 * frame (Omar 2026-11-11). The summary, the approaches
 * and the review stay mounted from the first paint (`EVALUATOR_KEEP_MOUNTED`). `focus` is how the
 * window sends the appraiser to a screen — a refused hand-over, a field error, «انتقل إلى …» or a
 * remembered screen after a refresh: the section opens and scrolls into view. Opening a section
 * by hand reports it through `onPick`, so the window remembers it for the next refresh.
 *
 * Edge cases: a focus that arrives before the step is known waits for it; a focus on a screen
 * whose approach is off is ignored.
 */
export function EvaluatorSectionsFrame({
  parts,
  navAvail,
  locked,
  focus,
  onPick,
  summary,
  footer,
  railAside,
}: {
  parts: ValuationWorkScreenParts;
  navAvail: { market: boolean; cost: boolean };
  locked: boolean;
  focus: EvaluatorSectionFocus | null;
  onPick: (screen: ValuationWorkScreenId) => void;
  summary: ReactNode;
  footer?: ReactNode;
  /** The hosting app's cards under the rail (the parties' status). */
  railAside?: ReactNode;
}) {
  const sections = useMemo(() => evaluatorSections(navAvail), [navAvail]);
  const ready = parts.current !== null || locked;
  const step = evaluatorSectionsStep(parts.current, locked);
  const state = useWorkSections<EvaluatorSectionId>({
    sections,
    step,
    ready,
    keepMounted: EVALUATOR_KEEP_MOUNTED,
    // The appraiser's own page: the sections he stands at carry the frame's tint.
    ownsPage: true,
  });

  const { openSection } = state;
  const handledFocus = useRef<EvaluatorSectionFocus | null>(null);
  useEffect(() => {
    if (!ready || !focus || handledFocus.current === focus) return;
    if (!sections.some((s) => s.id === focus.screen)) return;
    handledFocus.current = focus;
    openSection(focus.screen, true);
  }, [focus, openSection, ready, sections]);

  /** The frame's state with the appraiser's own picks reported to the window. */
  const picked = (id: EvaluatorSectionId) => {
    if (id !== "summary") onPick(id);
  };
  const reporting = {
    ...state,
    focusSection: (id: EvaluatorSectionId) => {
      state.focusSection(id);
      picked(id);
    },
    toggle: (id: EvaluatorSectionId) => {
      if (!state.open.has(id)) picked(id);
      state.toggle(id);
    },
  };

  return (
    <>
      {parts.lead}
      <WorkSectionsLayout
        sections={sections}
        step={step}
        state={reporting}
        railLabel="أقسام التقييم"
        // A section's body has no top padding of its own: the summary takes the shared gap, so
        // its first line does not sit on the header's rule.
        body={(id) =>
          id === "summary" ? <div className={WORK_SECTION_TOP_GAP}>{summary}</div> : parts.screens[id]
        }
        footer={footer}
        railAside={railAside}
      />
    </>
  );
}
