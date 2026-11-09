"use client";

/**
 * The frame shared by the transaction's two working pages (Omar 2026-11-08: «التصميم واحد، لكنهما
 * صفحتان مختلفتان») — the coordinator's page and the work page: numbered sections on a rail, each a
 * collapsible panel whose body mounts the first time it opens and stays mounted (hidden when collapsed)
 * so a half-filled form survives a collapse; the current step's sections open, and when the step moves
 * the new current sections open and scroll into view, so the page flows section to section.
 */
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  cn,
  FormDensityProvider,
  OpsIcon,
  opsContentPanel,
  type BadgeTone,
} from "@platform/ui-kit";
import {
  workSectionStatus,
  type WorkSectionStatus,
} from "../lib/app-data/work-page-model";

/** One section of a frame page: where it sits in the flow and how it is labelled. */
export type FrameSectionDef<Id extends string = string> = {
  id: Id;
  title: string;
  /** Sections sharing a step are worked together. */
  step: number;
  /** The sub-role badge (work page); none on the coordinator's page, where every section is coordination's. */
  group?: "co" | "st" | "rv";
};

const GROUP_LABEL = {
  co: "التنسيق",
  st: "دراسة العقار",
  rv: "المراجعة",
} as const;
const GROUP_TONE: Record<NonNullable<FrameSectionDef["group"]>, BadgeTone> = {
  co: "info",
  st: "warning",
  rv: "primary",
};
const STATUS_TEXT: Record<WorkSectionStatus, string> = {
  done: "مكتمل",
  current: "الخطوة الحالية",
  todo: "لم يبدأ",
};
const STATUS_TONE: Record<WorkSectionStatus, BadgeTone> = {
  done: "success",
  current: "warning",
  todo: "default",
};

export function sectionDomId(id: string): string {
  return `work-${id}`;
}

function hashSection(): string {
  return typeof window === "undefined"
    ? ""
    : window.location.hash.replace("#work-", "");
}

/** One numbered section: a header that opens / collapses it and its body. */
function WorkSection({
  def,
  number,
  status,
  open,
  mounted,
  onToggle,
  children,
}: {
  def: FrameSectionDef;
  number: number;
  status: WorkSectionStatus;
  open: boolean;
  mounted: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={sectionDomId(def.id)}
      aria-labelledby={`${sectionDomId(def.id)}-title`}
      className={cn(
        opsContentPanel,
        "scroll-mt-4 p-0",
        status === "current" &&
          "border-gold shadow-[0_0_0_3px_var(--gold-soft)]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-4 py-3 text-start"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-[13px] font-bold text-heading">
          {number}
        </span>
        <span
          id={`${sectionDomId(def.id)}-title`}
          className="text-[14.5px] font-extrabold text-heading"
        >
          {def.title}
        </span>
        {def.group ? (
          <Badge tone={GROUP_TONE[def.group]}>{GROUP_LABEL[def.group]}</Badge>
        ) : null}
        <Badge tone={STATUS_TONE[status]}>{STATUS_TEXT[status]}</Badge>
        <span className="flex-1" />
        <span
          aria-hidden
          className={cn(
            "text-text-3 transition-transform",
            !open && "-rotate-90",
          )}
        >
          ▾
        </span>
      </button>
      {mounted ? (
        <div hidden={!open} className="border-t border-border px-4 pb-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** A step worked elsewhere: what it is, and the button that opens it. */
export function StepLink({
  line,
  label,
  href,
}: {
  line: string;
  label: string;
  href: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3 pt-3">
      <span className="flex-1 text-[12.5px] text-text-2">{line}</span>
      {href ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(href)}
        >
          {label}
        </Button>
      ) : null}
    </div>
  );
}

export type WorkSectionsState<Id extends string> = {
  open: ReadonlySet<Id>;
  mounted: ReadonlySet<Id>;
  /** The section last picked on the rail (highlighted there); null until one is picked. */
  selected: Id | null;
  openSection: (id: Id, scroll: boolean) => void;
  /** The rail's pick: opens `id` alone (every other section collapses) and scrolls to it. */
  focusSection: (id: Id) => void;
  /** Every section open (true) or every section collapsed (false). */
  setAllOpen: (open: boolean) => void;
  toggle: (id: Id) => void;
};

/**
 * Which sections are open and mounted.
 *
 * How it works: the first paint opens the current step's sections plus the one the URL names
 * (`#work-{id}`); once `ready` (the tasks loaded — until then the step is a guess) that set is
 * replaced by the real current sections plus the named one, which scrolls into view. When the step
 * moves later, the new current sections open and the first scrolls into view. A `#work-…` link on
 * the page opens and scrolls to its section.
 * Edge cases: a step with no section of its own (the flow is past this page) opens nothing new.
 */
export function useWorkSections<Id extends string>({
  sections,
  step,
  ready,
}: {
  sections: readonly FrameSectionDef<Id>[];
  step: number;
  ready: boolean;
}): WorkSectionsState<Id> {
  const known = (id: string): id is Id => sections.some((s) => s.id === id);
  const currentIds = () =>
    sections.filter((s) => s.step === step).map((s) => s.id);

  const [open, setOpen] = useState<ReadonlySet<Id>>(() => {
    const hash = hashSection();
    const initial = new Set(currentIds());
    if (known(hash)) initial.add(hash);
    return initial;
  });
  const [mounted, setMounted] = useState<ReadonlySet<Id>>(open);
  const openSection = useCallback((id: Id, scroll: boolean) => {
    setOpen((prev) => new Set(prev).add(id));
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    if (scroll) {
      window.requestAnimationFrame(() =>
        document
          .getElementById(sectionDomId(id))
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  const [openedForStep, setOpenedForStep] = useState(false);
  const [seenStep, setSeenStep] = useState(step);
  const [scrollTo, setScrollTo] = useState<Id | null>(null);
  if (!openedForStep && ready) {
    setOpenedForStep(true);
    setSeenStep(step);
    const hash = hashSection();
    const current = currentIds();
    const next = new Set<Id>(known(hash) ? [...current, hash] : current);
    setOpen(next);
    setMounted((prev) => new Set([...prev, ...next]));
    if (known(hash)) setScrollTo(hash);
  }
  if (openedForStep && step !== seenStep) {
    setSeenStep(step);
    const current = currentIds();
    if (current.length > 0) {
      setOpen((prev) => new Set([...prev, ...current]));
      setMounted((prev) => new Set([...prev, ...current]));
      setScrollTo(current[0]!);
    }
  }
  useEffect(() => {
    if (!scrollTo) return;
    const frame = window.requestAnimationFrame(() =>
      document
        .getElementById(sectionDomId(scrollTo))
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [scrollTo]);

  const sectionIds = sections.map((s) => s.id).join("|");
  useEffect(() => {
    const ids = sectionIds.split("|");
    const onHash = () => {
      const id = hashSection();
      if (ids.includes(id)) openSection(id as Id, true);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [sectionIds, openSection]);

  const [selected, setSelected] = useState<Id | null>(null);
  const toggle = (id: Id) => {
    if (open.has(id)) {
      if (selected === id) setSelected(null);
      setOpen((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else openSection(id, false);
  };

  /**
   * Opens one section and collapses the rest (Omar 2026-11-08: a rail click folds every other section).
   *
   * How it works: `open` becomes just `id` and `id` becomes the rail's selected row; the collapsed
   * sections stay mounted (hidden), so a half-filled form survives; then the chosen section scrolls
   * into view once the others have folded.
   * Edge cases: collapsing the selected section from its own header clears the selection.
   */
  const focusSection = useCallback((id: Id) => {
    setSelected(id);
    setOpen(new Set([id]));
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    window.requestAnimationFrame(() =>
      document
        .getElementById(sectionDomId(id))
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  /**
   * The rail's expand / collapse-all arrow.
   *
   * How it works: expanding opens and mounts every section; collapsing closes them all (bodies stay
   * mounted, hidden, so half-filled forms survive) and clears the rail's selection.
   */
  const setAllOpen = (all: boolean) => {
    if (all) {
      const every = new Set(sections.map((s) => s.id));
      setOpen(every);
      setMounted((prev) => new Set([...prev, ...every]));
    } else {
      setOpen(new Set());
      setSelected(null);
    }
  };

  return { open, mounted, selected, openSection, focusSection, setAllOpen, toggle };
}

/** The rail's status marks (Omar 2026-11-08: symbols only): ✓ done, ⧗ in progress, — later. */
const RAIL_STATUS_ICON: Record<WorkSectionStatus, { path: string; className: string }> = {
  done: { path: "M20 6 9 17l-5-5", className: "text-success-text" },
  current: {
    path: "M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2",
    className: "text-gold-d",
  },
  todo: { path: "M6 12h12", className: "text-text-3" },
};

/**
 * A rail row's status as a symbol at the row's start — the right edge in RTL, before the bar.
 *
 * How it works: one stroked icon per status, coloured like the row's bar; the status text stays for
 * screen readers only (the section header keeps its badge).
 */
function RailStatusIcon({ status, onInk }: { status: WorkSectionStatus; onInk: boolean }) {
  const icon = RAIL_STATUS_ICON[status];
  // On the picked (ink) row the light-surface colours lose contrast — use the on-ink ones.
  const colour = onInk ? (status === "done" ? "text-on-ink-success" : "text-on-ink") : icon.className;
  return (
    <span className={cn("grid shrink-0 place-items-center", colour)}>
      <OpsIcon path={icon.path} size={15} />
      <span className="sr-only">{STATUS_TEXT[status]}</span>
    </span>
  );
}

/**
 * The rail and the sections: the numbered list on the right, the panels on the left, then `footer`
 * (the page's closing action, e.g. «إرسال المعاملة للدراسة»).
 *
 * The rail floats (sticky) on wide screens while the page scrolls. The page scrolls on the shell's
 * `#content`, so every box between it and the rail must not be a scroll container — the two pages
 * clip with `overflow-clip`, never `overflow-hidden` / `overflow-auto` (fixed 2026-11-08: the rail
 * scrolled away because the page's own `overflow-y-auto` wrapper, which never scrolls, held it).
 */
export function WorkSectionsLayout<Id extends string>({
  sections,
  step,
  state,
  railLabel,
  body,
  footer,
}: {
  sections: readonly FrameSectionDef<Id>[];
  step: number;
  state: WorkSectionsState<Id>;
  railLabel: string;
  body: (id: Id) => ReactNode;
  footer?: ReactNode;
}) {
  const allOpen = sections.every((s) => state.open.has(s.id));
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-3.5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav
        aria-label={railLabel}
        className={cn(opsContentPanel, "p-2 lg:sticky lg:top-4")}
      >
        {/* Expand / collapse every section (Omar 2026-11-08: a bare arrow, no label). */}
        <div className="flex justify-end pb-0.5">
          <button
            type="button"
            onClick={() => state.setAllOpen(!allOpen)}
            aria-label={allOpen ? "طي جميع الأقسام" : "توسيع جميع الأقسام"}
            aria-expanded={allOpen}
            className="grid size-6 cursor-pointer place-items-center rounded-md border-none bg-transparent text-text-3 hover:bg-row-hover hover:text-heading"
          >
            <span aria-hidden className={cn("transition-transform", allOpen && "rotate-180")}>
              <OpsIcon path="m6 9 6 6 6-6" size={15} />
            </span>
          </button>
        </div>
        <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
          {sections.map((s, i) => {
            const status = workSectionStatus(s, step);
            // The picked row is painted ink (the app's «selected» fill, as in FilterChips).
            const picked = state.selected === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => state.focusSection(s.id)}
                  aria-current={picked ? "location" : undefined}
                  className={cn(
                    // `cn` only joins classes, so the three looks are exclusive.
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg border-none px-2 py-1.5 text-start text-[12.5px]",
                    picked
                      ? "bg-ink font-bold text-on-ink"
                      : status === "current"
                        ? "bg-gold-soft font-bold text-heading hover:bg-row-hover"
                        : "bg-transparent text-text hover:bg-row-hover",
                  )}
                >
                  <RailStatusIcon status={status} onInk={picked} />
                  <span
                    aria-hidden
                    className={cn(
                      "w-1 self-stretch rounded-full",
                      status === "done"
                        ? picked
                          ? "bg-on-ink"
                          : "bg-ink"
                        : status === "current"
                          ? "bg-gold"
                          : "bg-border-md",
                    )}
                  />
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold",
                      picked ? "bg-on-ink text-ink" : "bg-surface-2",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-col gap-3">
        {sections.map((s, i) => (
          <WorkSection
            key={s.id}
            def={s}
            number={i + 1}
            status={workSectionStatus(s, step)}
            open={state.open.has(s.id)}
            mounted={state.mounted.has(s.id)}
            onToggle={() => state.toggle(s.id)}
          >
            {/* Omar 2026-11-09 (approved after a trial behind ?layout=new): every section's fields
                in four columns with one look — `FormDensityProvider value="work"`. */}
            <FormDensityProvider value="work">{body(s.id)}</FormDensityProvider>
          </WorkSection>
        ))}
        {footer}
      </div>
    </div>
  );
}
