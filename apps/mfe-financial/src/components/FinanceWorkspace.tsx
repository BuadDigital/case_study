"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseCostsSection,
  parseFinanceArea,
  parseRevenueStage,
  type CostsSection,
  type FinanceArea,
  type RevenueStage,
} from "../lib/finance-nav";
import { financeLeafForArea } from "@platform/app-shared/app-data/financial-nav";
import { FinanceMyTasks } from "./FinanceMyTasks";
import {
  EmptyState,
  opsLetterCard,
  preloadableLazy,
  useSwapAnimation,
  whenIdle,
} from "@platform/ui-kit";
import { useFinanceTabCounts } from "../query/finance-tab-counts";
import type { FinanceEngOfficePortal as EngOfficePortalType } from "./FinanceEngOfficePortal";
import type { FinanceInspectorPortal as InspectorPortalType } from "./FinanceInspectorPortal";

const areaChunkFallback = (
  <div className={opsLetterCard}>
    <EmptyState panel line="جاري التحميل…" />
  </div>
);

// Area views are client-only (the shell mounts this MFE with ssr:false).
// preloadableLazy: once a chunk is in, switching to its area renders at once
// instead of holding the loading card for React's suspense throttle.
const revenueView = preloadableLazy(() =>
  import("./FinanceRevenueView").then((m) => m.FinanceRevenueView),
);
const costsView = preloadableLazy(() =>
  import("./FinanceCostsView").then((m) => m.FinanceCostsView),
);
// The portals take `props = {}`, which the generic cannot infer through.
const engOfficePortal = preloadableLazy<
  NonNullable<ComponentProps<typeof EngOfficePortalType>>
>(() =>
  import("./FinanceEngOfficePortal").then((m) => m.FinanceEngOfficePortal),
);
const inspectorPortal = preloadableLazy<
  NonNullable<ComponentProps<typeof InspectorPortalType>>
>(() =>
  import("./FinanceInspectorPortal").then((m) => m.FinanceInspectorPortal),
);
const FinanceRevenueView = revenueView.Component;
const FinanceCostsView = costsView.Component;
const FinanceEngOfficePortal = engOfficePortal.Component;
const FinanceInspectorPortal = inspectorPortal.Component;

// Prefetch the route chunk on hover/focus of its tab (bundle-preload).
export const FINANCE_AREA_CHUNK_PRELOAD: Partial<
  Record<FinanceArea, () => Promise<unknown>>
> = {
  revenue: revenueView.preload,
  costs: costsView.preload,
  eng_portal: engOfficePortal.preload,
  inspector_portal: inspectorPortal.preload,
};

export function FinanceWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const counts = useFinanceTabCounts();

  const area = parseFinanceArea(searchParams.get("area"));
  const stage = parseRevenueStage(searchParams.get("stage"));
  const section = parseCostsSection(searchParams.get("section"));
  const focusPo = searchParams.get("po");
  const focusStatement = searchParams.get("statement");
  const focusParty = searchParams.get("party");
  const leaf = financeLeafForArea(area);

  // The core areas' code loads while the user reads the first one.
  useEffect(
    () =>
      whenIdle(() => {
        void revenueView.preload();
        void costsView.preload();
      }),
    [],
  );

  // Areas share the /financial pathname, so the shell's page fade does not run
  // between them; the payee list → account step is a view swap too.
  const areaRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(
    areaRef,
    area === "costs" ? `costs|${focusParty ? "account" : "list"}` : area,
  );

  const replaceParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const q = params.toString();
      const href = q ? `/financial?${q}` : "/financial";
      router.push(href, { scroll: false });
    },
    [router, searchParams],
  );

  const setStage = (next: RevenueStage) => {
    replaceParams({ area: "revenue", stage: next, po: null });
  };

  const setSection = (next: CostsSection) => {
    replaceParams({
      area: "costs",
      section: next,
      statement:
        next === "statements" || next === "dues" || next === "paid"
          ? focusStatement
          : null,
      party: next === "parties" ? null : focusParty,
    });
  };

  return (
    <div ref={areaRef} className="flex min-h-0 flex-1 flex-col">
      {area === "tasks" ? <FinanceMyTasks /> : null}
      <Suspense fallback={areaChunkFallback}>
        {area === "revenue" ? (
          <FinanceRevenueView
            stage={stage}
            onStageChange={setStage}
            focusPo={focusPo}
            onFocusPo={(po, forStage) =>
              replaceParams({
                area: "revenue",
                stage: forStage ?? stage,
                po,
              })
            }
          />
        ) : null}
        {area === "costs" ? (
          <FinanceCostsView
            section={section}
            onSectionChange={setSection}
            focusStatementId={focusStatement}
            onFocusStatement={(id, partyId) =>
              replaceParams({
                area: "costs",
                section: id
                  ? section === "paid"
                    ? "paid"
                    : "statements"
                  : section,
                statement: id,
                party: partyId?.trim() || focusParty,
              })
            }
            focusPartyId={focusParty}
            onFocusParty={(id, preferredSection) =>
              replaceParams({
                area: "costs",
                section: id
                  ? (preferredSection ?? "dues")
                  : "parties",
                party: id,
                statement: null,
              })
            }
            onEnsureParty={(partyId) => {
              const next = partyId.trim();
              if (!next || focusParty === next) return;
              replaceParams({
                area: "costs",
                section:
                  section === "parties" || !section
                    ? "statements"
                    : section,
                party: next,
                statement: focusStatement,
              });
            }}
            excludedCount={counts.excludedCount}
          />
        ) : null}
        {area === "eng_portal" ? (
          <FinanceEngOfficePortal focusPartyId={focusParty} />
        ) : null}
        {area === "inspector_portal" ? (
          <FinanceInspectorPortal
            focusPartyId={focusParty}
            onFocusParty={(id) =>
              replaceParams({
                area: "inspector_portal",
                party: id,
              })
            }
          />
        ) : null}
      </Suspense>

      <span className="sr-only">{leaf.pageTitle}</span>
    </div>
  );
}
