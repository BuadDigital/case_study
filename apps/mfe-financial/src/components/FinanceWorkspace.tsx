"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseCostsSection,
  parseFinanceArea,
  parseRevenueStage,
  type CostsSection,
  type FinanceArea,
  type RevenueStage,
} from "../lib/finance-nav";
import { financeLeafForArea } from "@platform/app-shared/prototype/financial-nav";
import { FinanceMyTasks } from "./FinanceMyTasks";
import { finCard, finEmpty, finEmptyT } from "../lib/finance-tw";
import { useFinanceTabCounts } from "../query/finance-tab-counts";

const areaChunkFallback = () => (
  <div className={finCard}>
    <div className={finEmpty}>
      <div className={finEmptyT}>جاري التحميل…</div>
    </div>
  </div>
);

const FinanceRevenueView = dynamic(
  () => import("./FinanceRevenueView").then((m) => m.FinanceRevenueView),
  { ssr: false, loading: areaChunkFallback },
);
const FinanceCostsView = dynamic(
  () => import("./FinanceCostsView").then((m) => m.FinanceCostsView),
  { ssr: false, loading: areaChunkFallback },
);
const FinanceEngOfficePortal = dynamic(
  () =>
    import("./FinanceEngOfficePortal").then((m) => m.FinanceEngOfficePortal),
  { ssr: false, loading: areaChunkFallback },
);
const FinanceInspectorPortal = dynamic(
  () =>
    import("./FinanceInspectorPortal").then((m) => m.FinanceInspectorPortal),
  { ssr: false, loading: areaChunkFallback },
);
// تحميل مسبق لحزمة المسار عند التحويم/التركيز على تبويبه (bundle-preload).
export const FINANCE_AREA_CHUNK_PRELOAD: Partial<
  Record<FinanceArea, () => Promise<unknown>>
> = {
  revenue: () => import("./FinanceRevenueView"),
  costs: () => import("./FinanceCostsView"),
  eng_portal: () => import("./FinanceEngOfficePortal"),
  inspector_portal: () => import("./FinanceInspectorPortal"),
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
    <div className="flex min-h-0 flex-1 flex-col">
      {area === "tasks" ? <FinanceMyTasks /> : null}
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

      <span className="sr-only">{leaf.pageTitle}</span>
    </div>
  );
}
