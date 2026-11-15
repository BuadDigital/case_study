"use client";

/**
 * The frame shared by the transaction's working pages (Omar 2026-11-08: «التصميم واحد، لكنهما
 * صفحتان مختلفتان») — the coordinator's page, the work page and, since 2026-11-10, the appraiser's
 * page (which lives in another app, hence the frame's place in the design system): numbered sections
 * on a rail, each a
 * collapsible panel whose body mounts the first time it opens and stays mounted (hidden when collapsed)
 * so a half-filled form survives a collapse. The page opens with every section folded (Omar
 * 2026-11-11, for every role); when the step moves while the viewer is on the page, the new current
 * sections open and scroll into view, so the page flows section to section.
 *
 * On a page shared by several sub-roles (the work page) the rail carries an eye (Omar 2026-11-11)
 * that hides the sections of the other sub-roles and shows them again; every section shows until
 * the viewer presses it.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ShowAllEye, useShowAllEyeBlink } from "../icons/show-all-eye";
import { cn } from "../lib/cn";
import { FormDensityProvider, WORK_FORM_GRID_CLASS } from "../lib/form-density";
import { opsContentPanel } from "../lib/ops-chrome";
import { OpsIcon } from "./OpsIcon";
import { Skeleton } from "./Skeleton";

export type WorkSectionStatus = "done" | "current" | "todo";

/** A section's status against the page's step (any frame page's section). */
export function workSectionStatus(
  section: { step: number },
  step: number,
): WorkSectionStatus {
  if (section.step < step) return "done";
  return section.step === step ? "current" : "todo";
}

/** One section of a frame page: where it sits in the flow and how it is labelled. */
export type FrameSectionDef<Id extends string = string> = {
  id: Id;
  title: string;
  /** Sections sharing a step are worked together. */
  step: number;
  /** The sub-role badge (work page); none on the coordinator's page, where every section is coordination's. */
  group?: "co" | "st" | "rv";
  /** A short label beside the title (the appraiser's page: the approach a method belongs to). */
  tag?: string;
};

export type FrameSectionGroup = NonNullable<FrameSectionDef["group"]>;

/**
 * Whose sections a shared page holds: the viewer's own (`mine`) and the other sub-roles' (`others`).
 *
 * How it works: a section is the viewer's when its group is one of `mineGroups`; another
 * sub-role's when it has a group that is not.
 * Edge cases: both lists come back empty when the split tells nothing apart — the viewer holds
 * every sub-role on the page (the supervisor), none of them, or the page has no groups (the
 * coordinator's page, the appraiser's); a section without a group is nobody's and stays out of both.
 */
export function sectionOwnership<Id extends string>(
  sections: readonly FrameSectionDef<Id>[],
  mineGroups: readonly FrameSectionGroup[] | undefined,
): { mine: Id[]; others: Id[] } {
  const isMine = (s: FrameSectionDef) => Boolean(s.group && mineGroups?.includes(s.group));
  const mine = sections.filter(isMine).map((s) => s.id);
  const others = sections.filter((s) => s.group && !isMine(s)).map((s) => s.id);
  return mine.length > 0 && others.length > 0 ? { mine, others } : { mine: [], others: [] };
}

/**
 * The sections the viewer must work on now — the only cards that carry the tint (Omar 2026-11-12:
 * «البطاقات التي يجب العمل عليها حاليا ملونة… المكتمل يعود للون الأبيض، الذي لا يخصني باللون
 * الأبيض، الذي يخصني وله إجراء يعتمد على السابق أبيض», for every role on every frame page).
 *
 * How it works: a section is listed when it is the viewer's own and its status is «الإجراء
 * الحالي». A section with a sub-role is his when he holds that sub-role (`mineGroups`); a section
 * without one is his when the page itself is his role's (`ownsPage` — the coordinator's page for a
 * coordinator, the appraiser's and the inspector's pages).
 * Edge cases: a viewer who holds every sub-role (the supervisor) gets every current section; a
 * finished section and one still waiting on an earlier step are never listed, whoever owns them.
 */
export function sectionsToActOn<Id extends string>(
  sections: readonly FrameSectionDef<Id>[],
  step: number,
  owner: { mineGroups?: readonly FrameSectionGroup[]; ownsPage?: boolean },
): Id[] {
  return sections
    .filter((s) => workSectionStatus(s, step) === "current")
    .filter((s) => (s.group ? Boolean(owner.mineGroups?.includes(s.group)) : owner.ownsPage === true))
    .map((s) => s.id);
}

const GROUP_LABEL = {
  co: "التنسيق",
  st: "دراسة العقار",
  rv: "المراجعة",
} as const;
const STATUS_TEXT: Record<WorkSectionStatus, string> = {
  done: "مكتمل",
  // «الإجراء الحالي» (Omar 2026-11-11; it read «الخطوة الحالية»).
  current: "الإجراء الحالي",
  todo: "لم يبدأ",
};
/** The status word's colour in a section's header — plain text, no fill behind it. */
const STATUS_TEXT_CLASS: Record<WorkSectionStatus, string> = {
  done: "font-semibold text-success-text",
  current: "font-bold text-amber-text",
  todo: "font-medium text-text-3",
};

export function sectionDomId(id: string): string {
  return `work-${id}`;
}

function hashSection(): string {
  return typeof window === "undefined"
    ? ""
    : window.location.hash.replace("#work-", "");
}

/**
 * The panel a section (and its loading skeleton) is drawn on, without bottom padding of its own.
 *
 * How it works: the body's `pb-4` is the one gap under a section's last block.
 * Edge cases: `opsContentPanel` carries `pb-5`, and a plain `p-0` beside it does not win (a side's
 * own class comes after the shorthand in the stylesheet) — every section kept ~18px of empty band
 * under its body; fixed 2026-11-11 with `!pb-0`. The panel's `px-5` stays: the pages are laid out
 * with it.
 */
const SECTION_PANEL_CLASS = cn(opsContentPanel, "p-0 !pb-0");

/**
 * TRIAL (Omar 2026-11-11: «لون خفيف لا يؤذي العين… على الأقل بطاقات الدور — خطوة قابلة للتراجع»):
 * the HEADER of the cards the viewer must work on now (`sectionsToActOn` — his own and current;
 * until 2026-11-12 every card of his sub-role, finished or waiting too) carries a very light wash
 * of the brand navy — the rest of the card stays white like every other card («طبّق على هيدر
 * البطاقة والباقي أبيض») — so his work is told apart at a glance. An open card's header keeps the
 * open band, a shade deeper.
 * To undo the trial, set this to "" — nothing else depends on it.
 * Other washes tried on paper: beige (`var(--row-hover)`) sinks into the page's cream; grey
 * (`var(--surface-2)`) is too close to white to notice.
 */
const ACT_NOW_TINT_CLASS =
  "bg-[color-mix(in_srgb,var(--ink)_3.5%,var(--surface))] hover:bg-[color-mix(in_srgb,var(--ink)_5%,var(--surface))]";

const STATUS_WORDS: readonly string[] = Object.values(STATUS_TEXT);

/**
 * A word that keeps the width of the widest of its kind, so what follows it starts at the same
 * place on every card (the section titles; the status words).
 *
 * How it works: the word and every candidate (`widest`) share one grid cell; the candidates are
 * drawn bold, invisible and with no height, so the cell is as wide as the widest of them — bold,
 * because an open card's title is bold and must not push its row.
 * Edge cases: below `lg` the cards are narrow and the words wrap, so nothing is reserved there.
 * `end` puts the word at the far edge of that width — the status words then line up on the rule
 * that follows them, each the same gap away from it (Omar 2026-11-11).
 */
function AlignedWord({
  widest,
  end = false,
  className,
  children,
}: {
  widest: readonly string[];
  /** Sit at the far edge of the reserved width, against what follows (the status, against its rule). */
  end?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-grid [&>*]:[grid-area:1/1]",
        end ? "justify-items-end" : "justify-items-start",
        className,
      )}
    >
      {children}
      {widest.map((word) => (
        <span
          key={word}
          aria-hidden
          className="invisible h-0 overflow-hidden whitespace-nowrap font-bold max-lg:hidden"
        >
          {word}
        </span>
      ))}
    </span>
  );
}

/** The thin upright rule between two words of a section's header. */
function HeaderRule() {
  return <span aria-hidden className="h-3.5 w-px shrink-0 bg-border-md" />;
}

/**
 * One numbered section: a header that opens / collapses it and its body.
 *
 * How it reads (Omar 2026-11-11: the open card and the viewer's own cards were not told apart):
 * - open: the header becomes a tinted band across the card and the number turns ink — the same
 *   ink the rail gives its picked row — with a firmer border, so the card being read stands out
 *   from the folded ones;
 * - the current step: its status word «الإجراء الحالي» in amber (and its rows on the rail);
 * - `mine` (a section of the viewer's own sub-role, on a page shared by several): its sub-role
 *   word is bold in the heading colour; the others' are grey.
 * - `actNow` (his own and current — `sectionsToActOn`): the folded card's header carries the tint;
 *   every other folded card is white.
 * Tried 2026-11-11 at Omar's request: every card keeps the page's own edge — the border and corners
 * of the other cards on the page — so the current step's gold outline and glow, the open card's
 * firmer border and the ink bar of `mine` are gone; and the sub-role, the tag and the status are
 * plain words parted by a thin rule, the status first («الإجراء الحالي | دراسة العقار»), each in
 * its own colour, instead of filled badges.
 * Edge cases: the panel pads its sides (`px-5`, which the pages are laid out with), so the header
 * band reaches the card's edges through a negative margin; a closed card's header only tints on hover.
 * `hidden` (the rail's eye) takes the whole card off the page but keeps it — and its mounted body —
 * in the tree, so a half-filled form is still there when the card shows again.
 */
function WorkSection({
  def,
  number,
  status,
  open,
  mounted,
  mine = false,
  actNow = false,
  hidden = false,
  titles,
  onToggle,
  children,
}: {
  def: FrameSectionDef;
  number: number;
  status: WorkSectionStatus;
  /** The titles of the sections on show — every title keeps the width of the longest. */
  titles: readonly string[];
  open: boolean;
  mounted: boolean;
  /** The section belongs to the viewer's own sub-role (marked only where it tells cards apart). */
  mine?: boolean;
  /** The viewer must work on this section now: his own and current (the tinted header). */
  actNow?: boolean;
  /** Another sub-role's section while the rail's eye hides them. */
  hidden?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={sectionDomId(def.id)}
      hidden={hidden}
      aria-labelledby={`${sectionDomId(def.id)}-title`}
      data-open={open ? "" : undefined}
      data-mine={mine ? "" : undefined}
      data-act-now={actNow ? "" : undefined}
      className={cn(SECTION_PANEL_CLASS, "scroll-mt-4")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "-mx-5 flex w-[calc(100%+2.5rem)] cursor-pointer items-center gap-2.5 border-none px-9 py-3 text-start transition-colors",
          // A pale wash of the brand ink: clear against the white card, light enough for the badges on it.
          open
            ? "bg-[color-mix(in_srgb,var(--ink)_5%,var(--surface))]"
            : actNow && ACT_NOW_TINT_CLASS
              ? ACT_NOW_TINT_CLASS
              : "bg-transparent hover:bg-row-hover",
        )}
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg border text-[13px] font-bold",
            open ? "border-ink bg-ink text-on-ink" : "border-border bg-surface-2 text-heading",
          )}
        >
          {number}
        </span>
        <AlignedWord widest={titles} className="text-[14.5px]">
          <span
            id={`${sectionDomId(def.id)}-title`}
            // Bold on the open card only (Omar 2026-11-11): the folded ones read as a quiet list.
            className={cn("text-heading", open ? "font-bold" : "font-normal")}
          >
            {def.title}
          </span>
        </AlignedWord>
        {/* The section's words after its title: status | sub-role | tag — plain text, a thin rule between.
            The status starts at the same place on every card, a gap after the longest title, and the
            rule after it lines up too (Omar 2026-11-11). */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] lg:ms-5">
          {/* Against its rule: a short word («مكتمل») keeps the same gap to the rule as the word after it. */}
          <AlignedWord widest={STATUS_WORDS} end>
            <span className={STATUS_TEXT_CLASS[status]}>{STATUS_TEXT[status]}</span>
          </AlignedWord>
          {def.group ? (
            <>
              <HeaderRule />
              <span className={mine ? "font-bold text-heading" : "font-medium text-text-2"}>
                {GROUP_LABEL[def.group]}
                {mine ? <span className="sr-only"> — دورك</span> : null}
              </span>
            </>
          ) : null}
          {def.tag ? (
            <>
              <HeaderRule />
              <span className="font-medium text-text-2">{def.tag}</span>
            </>
          ) : null}
        </span>
        <span className="flex-1" />
        <span
          aria-hidden
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md transition-transform",
            open ? "text-heading" : "rotate-90 text-text-3",
          )}
        >
          <OpsIcon path="m6 9 6 6 6-6" size={16} />
        </span>
      </button>
      {mounted ? (
        <div hidden={!open} className="-mx-5 border-t border-border px-9 pb-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** No section hidden: the eye is not pressed (one set for every page, so the state stays stable). */
const NO_SECTIONS: ReadonlySet<never> = new Set();

export type WorkSectionsState<Id extends string> = {
  open: ReadonlySet<Id>;
  mounted: ReadonlySet<Id>;
  /**
   * The section picked on the rail (highlighted there): the last one pressed, or at entry the one
   * the link names; null until then.
   */
  selected: Id | null;
  openSection: (id: Id, scroll: boolean) => void;
  /** The rail's pick: opens `id` alone (every other section collapses) and scrolls to it. */
  focusSection: (id: Id) => void;
  /** Every section on show open (true) or every section collapsed (false). */
  setAllOpen: (open: boolean) => void;
  toggle: (id: Id) => void;
  /** The viewer's own sections (marked as his); empty when the mark would tell nothing apart. */
  mine: ReadonlySet<Id>;
  /** The sections the viewer must work on now — his own and current (`sectionsToActOn`); tinted. */
  actNow: ReadonlySet<Id>;
  /** The sections the rail's eye is hiding now — the other sub-roles'; empty while every section shows. */
  hidden: ReadonlySet<Id>;
  /** The page holds the viewer's sections and other sub-roles': the rail shows its eye. */
  canHideOthers: boolean;
  /** The rail's eye: hide the other sub-roles' sections (true) or show every section (false). */
  setOthersHidden: (hidden: boolean) => void;
};

/**
 * Which sections are open and mounted.
 *
 * How it works: the page opens with every section folded (Omar 2026-11-11: «كل البطائق مطوية…
 * افتراضي عند الدخول», for every role — it used to open the current step's sections). A section
 * the URL names at entry (`#work-{id}` — a row of «أعمالي», a notification) stays folded too and
 * is only picked on the rail, so the viewer sees where the link points. When the step moves
 * later, while the viewer is on the page, the new current sections open and the first scrolls
 * into view. A `#work-…` link pressed on the page opens and scrolls to its section.
 * Edge cases: a step with no section of its own (the flow is past this page) opens nothing new.
 * `ready` (the tasks loaded — until then the step is a guess) is when step moves start to count.
 * `keepMounted` (2026-11-10, the appraiser's page) names sections whose bodies mount from the first
 * paint whether open or not — forms another section's action must be able to read or scroll to.
 *
 * The rail's eye (Omar 2026-11-11): `mineGroups` are the sub-roles the viewer holds; their sections
 * are `mine`, and `setOthersHidden(true)` hides the other sub-roles' sections (`hidden`). Every
 * section shows at first — the eye is the viewer's own choice, kept while he stays on the page.
 * Hiding also folds the sections left on show (Omar 2026-11-11: «تُطوى كلها»): what remains is the
 * viewer's own short list, opened one at a time. Showing them again folds or opens nothing.
 * Edge cases: asking for a hidden section (`openSection` — a link in another section, a `#work-…`
 * link) shows every section again, so the jump lands; a step that moves onto hidden sections opens
 * them where they are, hidden, and scrolls to the first one on show; a hidden section keeps its
 * open / mounted state for when it shows again, except that the rail's expand-all leaves it folded.
 */
export function useWorkSections<Id extends string>({
  sections,
  step,
  ready,
  keepMounted,
  mineGroups,
  ownsPage,
}: {
  sections: readonly FrameSectionDef<Id>[];
  step: number;
  ready: boolean;
  keepMounted?: readonly Id[];
  /**
   * The page is the viewer's own role's page, so its sections without a sub-role are his (the
   * coordinator's page for a coordinator, the appraiser's and the inspector's pages): the current
   * ones carry the tint — see `sectionsToActOn`.
   */
  ownsPage?: boolean;
  /**
   * The sub-roles the viewer holds (work page): their sections are marked as his and the rail's eye
   * can hide the rest. Only when it tells sections apart — see `sectionOwnership`.
   */
  mineGroups?: readonly FrameSectionGroup[];
}): WorkSectionsState<Id> {
  const known = (id: string): id is Id => sections.some((s) => s.id === id);
  const currentIds = () =>
    sections.filter((s) => s.step === step).map((s) => s.id);

  const owned = useMemo(() => {
    const { mine, others } = sectionOwnership(sections, mineGroups);
    return { mine: new Set(mine), others: new Set(others) };
  }, [sections, mineGroups]);
  const actNow = useMemo(
    () => new Set(sectionsToActOn(sections, step, { mineGroups, ownsPage })),
    [sections, step, mineGroups, ownsPage],
  );
  const [othersHidden, setOthersHidden] = useState(false);
  const hidden: ReadonlySet<Id> = othersHidden ? owned.others : NO_SECTIONS;

  // Folded at entry, whatever the step and whatever section the link names.
  const [open, setOpen] = useState<ReadonlySet<Id>>(() => new Set<Id>());
  const [mounted, setMounted] = useState<ReadonlySet<Id>>(
    () => new Set([...open, ...(keepMounted ?? [])]),
  );
  const openSection = useCallback(
    (id: Id, scroll: boolean) => {
      // Asked for while the eye hides it: every section shows again, so the jump lands.
      if (owned.others.has(id)) setOthersHidden(false);
      setOpen((prev) => new Set(prev).add(id));
      setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      if (scroll) {
        window.requestAnimationFrame(() =>
          document
            .getElementById(sectionDomId(id))
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    },
    [owned],
  );

  const [openedForStep, setOpenedForStep] = useState(false);
  const [seenStep, setSeenStep] = useState(step);
  const [scrollTo, setScrollTo] = useState<Id | null>(null);
  if (!openedForStep && ready) {
    setOpenedForStep(true);
    // The real step is known from here on: later moves open their sections. Nothing opens now.
    setSeenStep(step);
  }
  if (openedForStep && step !== seenStep) {
    setSeenStep(step);
    const current = currentIds();
    if (current.length > 0) {
      setOpen((prev) => new Set([...prev, ...current]));
      setMounted((prev) => new Set([...prev, ...current]));
      setScrollTo(current.find((id) => !hidden.has(id)) ?? null);
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

  // The section the entry link names is picked on the rail (and left folded).
  const [selected, setSelected] = useState<Id | null>(() => {
    const hash = hashSection();
    return known(hash) ? hash : null;
  });
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
   * How it works: expanding opens and mounts every section on show (those the eye hides stay
   * folded, so their bodies are not loaded behind the viewer's back); collapsing closes them all
   * (bodies stay mounted, hidden, so half-filled forms survive) and clears the rail's selection.
   */
  const setAllOpen = (all: boolean) => {
    if (all) {
      const every = new Set(sections.map((s) => s.id).filter((id) => !hidden.has(id)));
      setOpen(every);
      setMounted((prev) => new Set([...prev, ...every]));
    } else {
      setOpen(new Set());
      setSelected(null);
    }
  };

  /**
   * The rail's eye: hide the other sub-roles' sections, or show every section again.
   *
   * How it works: hiding folds every section left on show and clears the rail's selection (their
   * bodies stay mounted, so a half-filled form survives); a section being hidden keeps the open
   * state it had, for when it shows again. Showing changes nothing else.
   */
  const hideOthers = (hide: boolean) => {
    setOthersHidden(hide);
    if (!hide) return;
    setOpen((prev) => new Set([...prev].filter((id) => owned.others.has(id))));
    setSelected(null);
  };

  return {
    open,
    mounted,
    selected,
    openSection,
    focusSection,
    setAllOpen,
    toggle,
    mine: owned.mine,
    actNow,
    hidden,
    canHideOthers: owned.others.size > 0,
    setOthersHidden: hideOthers,
  };
}

/** A bare icon button at the rail's top (the eye, the expand / collapse arrow); the host adds its colours. */
const RAIL_TOOL_CLASS =
  "grid size-6 cursor-pointer place-items-center rounded-md border-none hover:bg-row-hover hover:text-heading";

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
 *
 * `railAside` (Omar 2026-11-11: «حالة الأطراف» under the rail) is the page's own card(s) drawn under
 * the rail, in the rail's column: it floats with the rail on wide screens and sits between the rail
 * and the sections on a phone.
 *
 * The eye (Omar 2026-11-11), beside the rail's arrow on a page shared by several sub-roles
 * (`state.canHideOthers` — the hook's `mineGroups`): pressed, the other sub-roles' sections leave
 * the rail and the page and a line under the rail says how many are hidden; pressed again, they
 * are back. A section keeps its number either way, so «القسم 8» is the same section for everyone.
 */
export function WorkSectionsLayout<Id extends string>({
  sections,
  step,
  state,
  railLabel,
  body,
  footer,
  railAside,
}: {
  sections: readonly FrameSectionDef<Id>[];
  step: number;
  state: WorkSectionsState<Id>;
  railLabel: string;
  body: (id: Id) => ReactNode;
  footer?: ReactNode;
  /** Cards under the rail, in its column (e.g. the parties' status). */
  railAside?: ReactNode;
}) {
  const { blink, triggerBlink } = useShowAllEyeBlink();
  const hiddenCount = sections.filter((s) => state.hidden.has(s.id)).length;
  const othersHidden = hiddenCount > 0;
  const allOpen = sections.every((s) => state.hidden.has(s.id) || state.open.has(s.id));
  const shownTitles = sections.filter((s) => !state.hidden.has(s.id)).map((s) => s.title);
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-3.5 lg:grid-cols-[230px_minmax(0,1fr)]">
      {/* The rail's column: the rail and the page's cards under it float together. */}
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4">
        <nav aria-label={railLabel} className={cn(opsContentPanel, "p-2")}>
          {/* The rail's tools: the eye (shared pages only), then expand / collapse every section
              (Omar 2026-11-08: a bare arrow, no label). */}
          <div className="flex items-center justify-end gap-0.5 pb-0.5">
            {state.canHideOthers ? (
              <button
                type="button"
                onClick={() => {
                  if (othersHidden) triggerBlink();
                  state.setOthersHidden(!othersHidden);
                }}
                aria-label="إخفاء الأقسام التي لا تخص دورك"
                aria-pressed={othersHidden}
                title={othersHidden ? "إظهار جميع الأقسام" : "إخفاء الأقسام التي لا تخص دورك"}
                data-testid="rail-hide-others"
                className={cn(
                  RAIL_TOOL_CLASS,
                  othersHidden ? "bg-surface-2 text-heading" : "bg-transparent text-text-3",
                )}
              >
                <ShowAllEye open={!othersHidden} blink={blink} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => state.setAllOpen(!allOpen)}
              aria-label={allOpen ? "طي جميع الأقسام" : "توسيع جميع الأقسام"}
              aria-expanded={allOpen}
              className={cn(RAIL_TOOL_CLASS, "bg-transparent text-text-3")}
            >
              <span aria-hidden className={cn("transition-transform", allOpen && "rotate-180")}>
                <OpsIcon path="m6 9 6 6 6-6" size={15} />
              </span>
            </button>
          </div>
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {sections.map((s, i) => {
              // Hidden by the eye: off the rail, its number kept for the rows that stay.
              if (state.hidden.has(s.id)) return null;
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
          {othersHidden ? (
            <p className="m-0 px-2 pt-1.5 text-[11.5px] text-text-3" data-testid="rail-hidden-count">
              أقسام مخفية لا تخص دورك: {hiddenCount}
            </p>
          ) : null}
        </nav>
        {railAside}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {sections.map((s, i) => (
          <WorkSection
            key={s.id}
            def={s}
            number={i + 1}
            status={workSectionStatus(s, step)}
            open={state.open.has(s.id)}
            mounted={state.mounted.has(s.id)}
            mine={state.mine.has(s.id)}
            actNow={state.actNow.has(s.id)}
            hidden={state.hidden.has(s.id)}
            titles={shownTitles}
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

/**
 * A section's body while its data loads: label + control placeholders in the work grid
 * (one to four a row), so the section keeps its shape when the fields arrive.
 */
export function WorkSectionFieldsSkeleton({
  fields = 8,
  label = "جاري التحميل…",
}: {
  fields?: number;
  label?: string;
}) {
  return (
    <div className={cn(WORK_FORM_GRID_CLASS, "pt-3.5")} aria-busy="true" aria-label={label}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="min-w-0">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-2 h-[38px] w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * The frame while the page's data loads (2026-11-10): the rail and the section panels in their
 * places, the first panel open on field placeholders.
 *
 * How it works: the same grid, panel and header sizes as `WorkSectionsLayout`, with pulse bars
 * for the rows and the titles — so the page does not jump when the real sections replace it.
 * Edge cases: the number of sections is not known yet (it depends on the loaded data), so the
 * page passes its usual count in `rows`.
 */
export function WorkSectionsSkeleton({
  rows = 4,
  label = "جاري تحميل أقسام الصفحة",
}: {
  rows?: number;
  label?: string;
}) {
  const items = Array.from({ length: rows }, (_, i) => i);
  return (
    <div
      className="grid min-w-0 grid-cols-1 items-start gap-3.5 lg:grid-cols-[230px_minmax(0,1fr)]"
      aria-busy="true"
      aria-label={label}
    >
      <div className={cn(opsContentPanel, "flex flex-col gap-2.5 p-3")}>
        {items.map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-5 shrink-0 rounded-md" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {items.map((i) => (
          <div key={i} className={SECTION_PANEL_CLASS}>
            <div className="flex items-center gap-2.5 px-4 py-3">
              <Skeleton className="size-7 shrink-0 rounded-lg" />
              <Skeleton className="h-4 w-48" />
            </div>
            {i === 0 ? (
              <div className="border-t border-border px-4 pb-4">
                <WorkSectionFieldsSkeleton label={label} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
