"use client";

/**
 * «أعمالي» — the start page of the case-study staff: every decision waiting for the viewer's
 * sub-roles in one list, and stage chips to work one stage in a batch (plan 2026-11-05, phase 1).
 * The rows come from `buildMyWork`. What waits for someone else is «المعاملات النشطة»'s, not here.
 * The appraiser (2026-11-10) and, on a desktop, the field inspector (2026-11-12) enter from it too.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import {
  Badge,
  FilterChips,
  GentleBusy,
  MobileRecordCard,
  MobileRecordList,
  OperationalToolbarSearch,
  PageShell,
  PageToolbar,
  RowMoreMenu,
  QueryErrorState,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
  cn,
  opsLetterCard,
  useToast,
  type BadgeTone,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useTickingMinute, useTickingNow } from "@platform/app-shared/hooks/use-ticking-now";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { formatDateAr } from "@platform/app-shared/format/date";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { useReportDraftStates } from "@platform/app-shared/workflow/use-report-draft-states";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { PropertyListRowStatuses } from "@platform/api-client";
import {
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  usePropertyListItemsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { SituationBar } from "../components/active-transactions/ActiveTransactionsSituationBar";
import type { PageSituationCardDef } from "../lib/app-data/active-transaction-page-situation";
import { filterActionablePendingBourseItems } from "../lib/app-data/pending-bourse-queue";
import { tasksForRole, type WorkflowTask } from "../lib/app-data/tasks";
import { seesAllCaseStudyWorkflowTasks } from "../lib/app-data/viewer-task-access";
import { isFoldedAppraisalTask } from "@platform/app-shared/workflow/task-types";
import { workspaceHasDraftProgress } from "../lib/app-data/field-inspection-work-queue";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import {
  MY_WORK_GROUPS,
  buildMyWork,
  defaultMyWorkStage,
  formatActionClock,
  isCaseSpecialistGroup,
  isMyWorkLookupStage,
  myWorkGroupsForPages,
  type InspectionPackageState,
  type MyWorkDue,
  type MyWorkItem,
  type MyWorkStage,
} from "../lib/app-data/my-work-model";
import { buildPoByNumber } from "./active-transaction-queue-state";
import { FavoriteStar } from "../components/ui/FavoriteStar";
import { MY_WORK_PIN_LIMIT, pinnedFirst, useMyWorkPins } from "../lib/app-data/my-work-pins";
import { QueueRowMoreCell } from "./active-transaction-queue-row-parts";
import { useMyWorkRowMenu } from "./useMyWorkRowMenu";
import { useActiveReopeningsQuery } from "../query/use-active-reopenings-query";

const EMPTY_TASKS: WorkflowTask[] = [];

const DUE_TONE: Record<MyWorkDue, BadgeTone> = {
  late: "danger",
  soon: "warning",
  ok: "default",
  none: "default",
};

const CARDS: PageSituationCardDef[] = [
  { key: "open", label: "ينتظرك", sub: "قرارات لأدوارك", tone: "blue" },
  { key: "late", label: "متأخرة عن المهلة", sub: "ابدأ بها", tone: "red" },
  {
    key: "soon",
    label: "تنتهي اليوم أو غدًا",
    sub: "مهلة قريبة",
    tone: "warn",
  },
];

function DueBadge({ item }: { item: Pick<MyWorkItem, "due" | "dueText"> }) {
  return (
    <Badge tone={DUE_TONE[item.due]} className="whitespace-nowrap">
      {item.dueText}
    </Badge>
  );
}

/**
 * The row's action as a tag (Omar 2026-11-08): the step in navy («دراسة العقار», «متابعة الأطراف»…),
 * or — for a transaction reopened after its approval — «معادة للدراسة» in amber INSTEAD of the step, one
 * tag per row (Omar: «اكتفي بمعادة للتعديل»). The line under it still says where the work stands.
 * Named «معادة للدراسة» by Omar 2026-11-08 (after «معاد فتحها» and «معادة للتعديل»), knowing a
 * reopening may also touch the valuation or the upload.
 * The step due is the brand's solid navy; advance work («إعداد مسبق», the appraiser's valuation whose
 * study is not issued — 2026-11-11) keeps navy's light wash: it can be entered, but nothing is due yet.
 */
function ActionTag({ item }: { item: Pick<MyWorkItem, "action" | "reopened" | "stage"> }) {
  return item.reopened ? (
    <Badge tone="warning" className="whitespace-nowrap">
      معادة للدراسة
    </Badge>
  ) : (
    <Badge tone="primary" filled={item.stage !== "prework"} className="whitespace-nowrap">
      {item.action}
    </Badge>
  );
}

/** The deadline's colour, as «أوامر العمل» colours an urgent one: late red, close amber, else heading. */
const DUE_TEXT_CLASS: Record<MyWorkDue, string> = {
  late: "text-red",
  soon: "text-amber-text",
  ok: "text-heading",
  none: "text-heading",
};

/** An empty cell's «—», muted like every empty cell of the system's tables. */
function Muted() {
  return <span className="text-[13px] text-text-3">—</span>;
}

/**
 * «تاريخ الاستلام / الاستحقاق»: the PO's receipt date over its deadline, the deadline coloured by how
 * close it is (late red, today/tomorrow gold) with the short state («متأخرة», «تنتهي غدًا») beside it.
 */
function MyWorkDates({
  item,
}: {
  item: Pick<MyWorkItem, "receivedIso" | "dueIso" | "due" | "dueText">;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-[13px] tabular-nums">
      {/* bdi: «DD/MM/YYYY» must not be reordered by the RTL row (as `TdLtr` in «أوامر العمل»). */}
      <span className="text-text-2">
        <bdi dir="ltr">{item.receivedIso ? formatDateAr(item.receivedIso) : "—"}</bdi>
      </span>
      <span className={cn("font-semibold", DUE_TEXT_CLASS[item.due])}>
        <bdi dir="ltr">{item.dueIso ? formatDateAr(item.dueIso) : "—"}</bdi>
        {item.due === "late" || item.due === "soon" ? (
          <span className="ms-1.5 text-[12px] font-medium">{item.dueText}</span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * «وقت الإجراء» — a running clock from when the action reached the viewer (Omar 2026-11-08).
 *
 * How it works: subscribes to the shared one-second clock (`useTickingNow`) here, in the leaf, so
 * only the clock cells re-render each second, not the page.
 */
function ActionClock({ arrivedIso, stopped }: { arrivedIso: string; stopped?: boolean }) {
  const nowMs = useTickingNow();
  // A handed-over row asks nothing of the viewer (Omar 2026-11-11): no clock runs against him.
  if (stopped) return <span className="text-[13px] text-text-3">—</span>;
  return (
    <span className="text-[13px] font-semibold tabular-nums text-heading">
      {formatActionClock(arrivedIso, nowMs)}
    </span>
  );
}

/**
 * The row's pin (Omar 2026-11-12), a star at the start of the row: an outline until pressed, then
 * filled, and the transaction rises to the top of its stage's list until it is sent on to the next
 * step. It never opens the row.
 */
function PinButton({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  const label = pinned ? "إلغاء تثبيت المعاملة" : "تثبيت المعاملة أعلى القائمة";
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      data-testid="my-work-pin"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-none bg-transparent leading-none hover:bg-row-hover"
    >
      <FavoriteStar on={pinned} size={18} />
    </button>
  );
}

export function MyWorkView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { role, rolePages } = useAppAccess();
  const nowMs = useTickingMinute();
  // The chip picked by hand: a stage, «الكل» ("all"), or null while none was picked — the page then
  // follows the role's own stage (`defaultMyWorkStage`, Omar 2026-11-11).
  const [picked, setPicked] = useState<MyWorkStage | "all" | null>(null);
  const [search, setSearch] = useState("");

  const tasksQuery = useWorkflowTasksQuery();
  const poQuery = usePoRecordsQuery();
  const bourseQuery = usePendingBourseItemsQuery();
  const failuresQuery = useFailuresQuery();
  const groups = useMemo(() => myWorkGroupsForPages(rolePages), [rolePages]);
  // The reopenings list is the specialists' read: the appraiser's and the inspector's pages do not ask for it.
  const reopenings = useActiveReopeningsQuery(groups.some(isCaseSpecialistGroup));
  // The inspector's own inspections (Omar 2026-11-12): each package's status says whether it is
  // new, in progress, returned to him or sent — the list his queue page reads.
  const inspectionsQuery = useFieldInspectionWorkspacesQuery(groups.includes("fi"));
  const inspectionPackages = useMemo(
    () =>
      new Map<string, InspectionPackageState>(
        (inspectionsQuery.data ?? []).map((w) => [
          w.workflowTaskId,
          { status: w.status, started: w.status === "draft" || workspaceHasDraftProgress(w) },
        ]),
      ),
    [inspectionsQuery.data],
  );
  // «المرسلة» keeps a sent inspection only while its transaction is live: the server's property
  // row says «مكتمل» once it is uploaded to Enfaz, and «ملغاة» when it is cancelled.
  const propertyRowsQuery = usePropertyListItemsQuery(groups.includes("fi"));
  const finishedProperties = useMemo(
    () =>
      new Set(
        (propertyRowsQuery.data ?? [])
          .filter(
            (item) =>
              item.row.status === PropertyListRowStatuses.Done ||
              item.row.status === PropertyListRowStatuses.Cancelled,
          )
          .map((item) => item.propertyId),
      ),
    [propertyRowsQuery.data],
  );
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const mine = useMemo(
    () =>
      seesAllCaseStudyWorkflowTasks(role) ? tasks : tasksForRole(role, tasks),
    [role, tasks],
  );

  // The draft / deposit stages read the valuation draft states (they live in the valuation service).
  // The appraiser's own valuations too (Omar 2026-11-10): the draft state says whether a valuation
  // started and whether a draft waits for his approval.
  const asAppraiser = groups.includes("ap");
  const draftPropertyIds = useMemo(
    () =>
      mine
        .filter(
          (t) =>
            (t.kind === "case-study-property" &&
              t.studyReportIssued &&
              !t.propertyHandedOverToEnfaz) ||
            (asAppraiser &&
              t.kind === "property-appraisal" &&
              t.status !== "cancelled" &&
              t.status !== "completed" &&
              !isFoldedAppraisalTask(t)),
        )
        .map((t) => t.propertyId),
    [mine, asAppraiser],
  );
  const draftVersion = useReportDraftStates(
    draftPropertyIds,
    groups.includes("st") || groups.includes("rv") || asAppraiser,
  );

  const poByNumber = useMemo(
    () => buildPoByNumber(poQuery.data ?? []),
    [poQuery.data],
  );
  const { itemsFor, modals } = useMyWorkRowMenu({ tasks, poByNumber });

  const work = useMemo(() => {
    void draftVersion;
    const pendingBourse = filterActionablePendingBourseItems(
      bourseQuery.data ?? [],
      failuresQuery.data ?? [],
    );
    return buildMyWork({
      groups,
      mine,
      allTasks: tasks,
      poByNumber,
      pendingBourse,
      draftState: (id) => getReportDraftState(id),
      inspectionPackage: (taskId) => inspectionPackages.get(taskId),
      transactionFinished: (propertyId) => finishedProperties.has(propertyId),
      reopenings,
      now: new Date(nowMs),
    });
  }, [
    groups,
    mine,
    tasks,
    poByNumber,
    bourseQuery.data,
    failuresQuery.data,
    draftVersion,
    inspectionPackages,
    finishedProperties,
    reopenings,
    nowMs,
  ]);

  const visibleGroups = useMemo(
    () => MY_WORK_GROUPS.filter((g) => groups.includes(g.key)),
    [groups],
  );
  // Omar 2026-11-08: with a single stage (the study alone) «الكل» and that stage list the same rows —
  // the chips filter nothing, so only the search is shown.
  const showStageChips =
    visibleGroups.reduce((n, g) => n + g.stages.length, 0) > 1;
  // The chip in force (null = «الكل»). Until one is picked by hand it is the first stage with an
  // action due from the viewer, so it moves on as a stage empties and the next one fills (the
  // appraiser: «التقييم», then «مسودة بانتظار اعتمادك»); with nothing due, his first chip.
  const defaultStage = useMemo(
    () => defaultMyWorkStage(groups, work.items),
    [groups, work.items],
  );
  const stage: MyWorkStage | null = !showStageChips
    ? null
    : picked === null
      ? defaultStage
      : picked === "all"
        ? null
        : picked;

  // The stage chip, then the search box (deed, PO, transaction number, place, type or action).
  // Pinned rows (Omar 2026-11-12): up to five per stage, drawn first; a pin ends when its row goes.
  const { pinnedKeys, toggle: togglePinned, endFinished: endFinishedPins } = useMyWorkPins();
  const listed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = work.items.filter(
      (i) =>
        // «الكل» is what waits for him: the lookup rows (handed over, sent) show under their own chip only.
        (stage ? i.stage === stage : !isMyWorkLookupStage(i.stage)) &&
        (!q ||
          [
            i.deedNumber,
            i.poNumber,
            i.transactionNumber ?? "",
            i.place,
            i.propertyType ?? "",
            i.action,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
    return pinnedFirst(rows, pinnedKeys);
  }, [work.items, stage, search, pinnedKeys]);

  const pending = tasksQuery.isPending || poQuery.isPending;
  const failed = [tasksQuery, poQuery].filter(queryLoadFailed);
  const waiting = useMemo(() => work.items.filter((i) => !isMyWorkLookupStage(i.stage)), [work.items]);
  const values =
    pending || failed.length
      ? {}
      : {
          open: waiting.length,
          late: waiting.filter((i) => i.due === "late").length,
          soon: waiting.filter((i) => i.due === "soon").length,
        };

  // A pin ends once its transaction was sent on: its row is no longer in the stage. Checked only
  // against the settled list — while anything still loads (the draft states, the inspections) a
  // row may stand under another stage for a moment, and that must not end a pin.
  const fetching = useIsFetching();
  const listSettled =
    !pending &&
    failed.length === 0 &&
    fetching === 0 &&
    !bourseQuery.isError &&
    !inspectionsQuery.isError &&
    !propertyRowsQuery.isError;
  useEffect(() => {
    if (!listSettled) return;
    const timer = window.setTimeout(() => endFinishedPins(work.items), 1000);
    return () => window.clearTimeout(timer);
  }, [listSettled, work.items, endFinishedPins]);
  const pin = (item: MyWorkItem) => {
    if (togglePinned(item) === "full") {
      showToast(
        `يمكن تثبيت ${MY_WORK_PIN_LIMIT} معاملات كحد أقصى في كل مرحلة — ألغِ تثبيت إحداها أولًا`,
        "error",
      );
    }
  };

  const countOf = (s: MyWorkStage) =>
    work.items.filter((i) => i.stage === s).length;
  const lateOf = (s: MyWorkStage) =>
    work.items.some((i) => i.stage === s && i.due === "late");
  const open = (href: string) => router.push(href);

  return (
    // Spaced like «أوامر العمل»: the shell's gap-3 is the only space between blocks (no margins).
    <PageShell variant="canvas" className="h-fit min-w-0 max-w-full gap-3 py-4 sm:py-5">
      <SituationBar cards={CARDS} values={values} flush />

      {visibleGroups.length > 0 ? (
        // The system's list toolbar (as «أوامر العمل»): search first, then every chip on one row —
        // «الكل», then each group's stage chips (Omar 2026-11-08: one row, more room for the list).
        // Wraps only on narrow screens.
        <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b-0 bg-transparent px-0 py-0">
          <OperationalToolbarSearch
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="رقم الصك أو الأمر أو المعاملة أو المدينة…"
            aria-label="بحث في أعمالي"
            className="max-lg:min-w-0 max-lg:flex-1"
          />
          {showStageChips ? (
            <FilterChips
              options={[
                {
                  key: "all",
                  label: "الكل — ما ينتظرني",
                  count: waiting.length,
                },
              ]}
              active={stage === null ? "all" : null}
              onChange={() => setPicked("all")}
            />
          ) : null}
          {(showStageChips ? visibleGroups : []).map((g, i) => (
            // No group label (Omar 2026-11-08: «شيل كلمة التنسيق»); a thin divider still parts
            // two groups' chips for someone holding more than one sub-role.
            <div key={g.key} aria-label={g.label} role="group" className="flex min-w-0 items-center gap-2">
              {i > 0 ? <span aria-hidden className="h-5 w-px shrink-0 bg-border-md" /> : null}
              <FilterChips
                options={g.stages.map((s) => ({
                  key: s.key,
                  label: s.label,
                  count: countOf(s.key),
                  danger: lateOf(s.key),
                }))}
                active={stage}
                // A second click on the active chip clears it: back to «الكل».
                onChange={(key) => setPicked((key as MyWorkStage | null) ?? "all")}
              />
            </div>
          ))}
        </PageToolbar>
      ) : null}

      <section aria-label="ما ينتظرني" className="min-w-0">
        {pending ? (
          <div
            className={cn(
              opsLetterCard,
              "rounded-xl border-border bg-surface px-5 py-12 text-center",
            )}
          >
            <GentleBusy>جاري التحميل…</GentleBusy>
          </div>
        ) : failed.length ? (
          <div
            className={cn(opsLetterCard, "rounded-xl border-border bg-surface")}
          >
            <QueryErrorState
              panel
              line="تعذّر تحميل أعمالك"
              error={failed[0]!.error}
              onRetry={() => failed.forEach((q) => void q.refetch())}
              retrying={failed.some((q) => q.isFetching)}
            />
          </div>
        ) : listed.length === 0 ? (
          <div
            className={cn(
              opsLetterCard,
              "rounded-xl border-border bg-surface px-5 py-12 text-center",
            )}
          >
            <div className="text-sm font-bold text-text-2">
              {search.trim()
                ? "لا نتائج مطابقة للبحث"
                : stage === "handed"
                  ? "لا توجد تقييمات مسلَّمة"
                  : stage === "inspection-sent"
                    ? "لا توجد معاينات مرسلة"
                  : stage === "prework"
                    ? "لا توجد تقييمات بانتظار الدراسة"
                    : `لا شيء ينتظرك ${stage ? "في هذه المرحلة" : "الآن"}`}
            </div>
            <div className="mt-1 text-[13px] text-text-3">
              {stage === "handed"
                ? "تظهر هنا التقييمات التي سلّمتها ريثما تصدر مسودة التقرير أو يُودَع."
                : stage === "inspection-sent"
                  ? "تظهر هنا المعاينات التي أرسلتها ما دامت معاملتها لم تكتمل في النظام."
                : stage === "prework"
                  ? "تظهر هنا التقييمات التي لم تصدر دراستها بعد: يمكن إعدادها كمسودة، وتنتقل إلى «التقييم» عند صدور الدراسة."
                  : "تظهر هنا كل خطوة تصل إلى أدوارك، ويختفي الصف بعد تنفيذها."}
            </div>
          </div>
        ) : (
          <>
            <MobileRecordList className="lg:hidden">
              {listed.map((item) => (
                <MobileRecordCard
                  key={item.key}
                  tone={
                    item.due === "late"
                      ? "red"
                      : item.due === "soon"
                        ? "gold"
                        : undefined
                  }
                  title={item.action}
                  subtitle={item.reason}
                  status={
                    // A→Z 2026-11-09: the phone card showed no «معادة للدراسة» — it sat on the table only.
                    item.reopened ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <ActionTag item={item} />
                        <DueBadge item={item} />
                      </span>
                    ) : (
                      <DueBadge item={item} />
                    )
                  }
                  onOpen={() => open(item.href)}
                  actions={
                    <span className="flex items-center gap-2">
                      <PinButton pinned={pinnedKeys.has(item.key)} onToggle={() => pin(item)} />
                      <RowMoreMenu items={itemsFor(item)} />
                    </span>
                  }
                  fields={[
                    { label: "رقم المعاملة", value: item.transactionNumber || "—", ltr: true },
                    { label: "رقم الصك / التسجيل العيني", value: item.deedNumber, ltr: true },
                    { label: "المدينة / الحي", value: item.place },
                    {
                      label: "أمر العمل",
                      value: (
                        <span className="flex flex-col">
                          <bdi dir="ltr">{item.poNumber}</bdi>
                          {item.poDescription ? (
                            <span className="text-[11px] text-text-2">{item.poDescription}</span>
                          ) : null}
                        </span>
                      ),
                    },
                    {
                      label: "تاريخ الاستلام / الاستحقاق",
                      value: <MyWorkDates item={item} />,
                    },
                    {
                      label: "وقت الإجراء",
                      value: <ActionClock arrivedIso={item.arrivedIso} stopped={isMyWorkLookupStage(item.stage)} />,
                    },
                  ]}
                />
              ))}
            </MobileRecordList>
            <TableFrame className="max-lg:hidden">
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    {/* Widths follow the content (Omar 2026-11-08): no fixed widths — the table shares
                        its free width out in proportion to each column's widest line (values are kept
                        on one line, the PO description capped at 220px, so that line is the real
                        content). Only ⋮ shrinks to its button. The two long headers break onto two
                        lines so they are no wider than their values. */}
                    <Th className="w-px">
                      <span className="sr-only">تثبيت</span>
                    </Th>
                    <Th>رقم المعاملة</Th>
                    <Th className="text-center">
                      رقم الصك /<br />
                      التسجيل العيني
                    </Th>
                    <Th className="text-center">المدينة / الحي</Th>
                    <Th className="text-center">أمر العمل</Th>
                    <Th className="text-center">الإجراء المطلوب</Th>
                    <Th className="text-center">
                      تاريخ الاستلام /<br />
                      الاستحقاق
                    </Th>
                    <Th className="text-center">وقت الإجراء</Th>
                    <Th className="w-px">
                      <span className="sr-only">المزيد</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {listed.map((item) => (
                    // The whole row opens the step (Omar 2026-11-08: no «افتح» button); the action's
                    // name is the row's keyboard target.
                    <Tr
                      key={item.key}
                      className="cursor-pointer"
                      onClick={() => open(item.href)}
                    >
                      {/* Type scale (as «أوامر العمل»): the row's key, the transaction number, 13.5px
                          bold gold; the action a tag (Badge); values 13px; lines under them 12px text-2;
                          «—» muted. Every column but the transaction number is centred (Omar 2026-11-08). */}
                      <Td className="w-px pe-0">
                        <PinButton pinned={pinnedKeys.has(item.key)} onToggle={() => pin(item)} />
                      </Td>
                      <Td className="whitespace-nowrap">
                        {item.transactionNumber ? (
                          <bdi dir="ltr" className="text-[13.5px] font-bold tabular-nums text-primary">
                            {item.transactionNumber}
                          </bdi>
                        ) : (
                          <Muted />
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-center">
                        {item.deedNumber && item.deedNumber !== "—" ? (
                          <bdi dir="ltr" className="text-[13px] font-semibold tabular-nums text-heading">
                            {item.deedNumber}
                          </bdi>
                        ) : (
                          <Muted />
                        )}
                      </Td>
                      <Td className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {item.place && item.place !== "—" ? (
                            <span className="whitespace-nowrap text-[13px] text-text">{item.place}</span>
                          ) : (
                            <Muted />
                          )}
                          {item.propertyType ? (
                            <span className="whitespace-nowrap text-[12px] text-text-2">{item.propertyType}</span>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-center">
                        <div className="flex min-w-0 flex-col items-center gap-0.5">
                          <bdi dir="ltr" className="whitespace-nowrap text-[13px] tabular-nums text-text">
                            {item.poNumber}
                          </bdi>
                          {item.poDescription ? (
                            <span
                              className="line-clamp-2 w-max max-w-[220px] text-[12px] text-text-2"
                              title={item.poDescription}
                            >
                              {item.poDescription}
                            </span>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-center">
                        <div className="flex min-w-0 flex-col items-center gap-1 py-1">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                open(item.href);
                              }}
                              className="cursor-pointer rounded-full border-none bg-transparent p-0 hover:opacity-85"
                            >
                              <ActionTag item={item} />
                            </button>
                          </div>
                          <span className="text-[12px] text-text-2">
                            {item.reason}
                          </span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-center">
                        <MyWorkDates item={item} />
                      </Td>
                      <Td className="whitespace-nowrap text-center">
                        <ActionClock arrivedIso={item.arrivedIso} stopped={isMyWorkLookupStage(item.stage)} />
                      </Td>
                      <QueueRowMoreCell items={itemsFor(item)} />
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          </>
        )}
      </section>
      {modals}
    </PageShell>
  );
}
