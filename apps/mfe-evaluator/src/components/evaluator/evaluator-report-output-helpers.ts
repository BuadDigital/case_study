import {
  getApiBase,
  getBuildingInventory,
  getPartyTaskSubmission,
  getValuationApproachSettings,
  getValuationCostApproach,
  getValuationLists,
  getValuationReconciliation,
  listClients,
  listValuationComparableSelections,
  ensureOpenValuationRequestByProperty,
  type BuildingInventoryLineDto,
  type ClientDto,
  type ValuationApproachSettingsDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { fetchInspectorWorkspace } from "../../lib/case-study-bridge";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import type { ValuationReportSurveyBounds } from "../../lib/evaluator/valuation-report-live-fill";
import {
  collectInspectorPhotoAttachmentIds,
  loadValuationReportPrintAttachments,
  surveyReportAttachmentIdFromPayload,
  type ValuationReportSlotAttachment,
} from "../../lib/evaluator/valuation-report-print-attachments";

type ValuationApiConfig = { token: string; baseUrl: string };

declare global {
  interface Window {
    __ejadahImageSlotsEditable?: boolean;
  }
}

let imageSlotScriptPromise: Promise<void> | null = null;

export function ensureImageSlotCustomElement(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("image-slot")) return Promise.resolve();
  if (imageSlotScriptPromise) return imageSlotScriptPromise;
  imageSlotScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ejadah-image-slot]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("image-slot")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "/ejadah/image-slot.js";
    script.async = true;
    script.dataset.ejadahImageSlot = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("تعذّر تحميل image-slot.js"));
    document.head.appendChild(script);
  });
  return imageSlotScriptPromise;
}

/**
 * Some errors thrown in this file already carry a real Arabic message the developer wrote
 * on purpose (e.g. the template-fetch failure in valuation-report-v3-preview.ts). A raw
 * browser/network exception ("Failed to fetch", "NetworkError…") is English and should not
 * reach the appraiser — keep the message only when it's actually Arabic, otherwise show the
 * clear fallback and log the real cause for diagnostics.
 */
/** Appraiser-facing text for a failed report action. */
export function arabicErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && /[؀-ۿ]/.test(err.message)) return err.message;
  if (err instanceof Error) console.warn("[evaluator] report output tab error:", err);
  return fallback;
}

/** Old shortened defaults — replace with HTML v3 full copy when still stored in org settings. */
const LEGACY_SHORT_FINISHING = new Set([
  "واجهات حجر طبيعي أو دهان عالي الجودة، أرضيات مداخل ومجالس من رخام فاخر، عزل ونوافذ عالية، تكييف مركزي ومصعد.",
  "واجهات حجر أو دهان، أرضيات سيراميك، تكييف منفصل (سبليت)، مكونات جدران مزدوجة.",
  "واجهات دهان، أرضيات سيراميك عادي أو بلاط بلدي، شبابيك عادية، تكييف شباك، بدون جبس أسقف.",
]);

export function finishingTextForReport(stored: string, htmlV3Default: string): string {
  const t = (stored ?? "").trim();
  if (!t || LEGACY_SHORT_FINISHING.has(t)) return htmlV3Default;
  return t;
}

async function loadValuationApproaches(
  config: ValuationApiConfig,
  property: PoPropertyIntake | null | undefined,
): Promise<{
  /** Open valuation request for this property — target of the report PDF link endpoint. */
  valuationRequestId: string | null;
  market: ValuationComparableSelectionListDto | null;
  landMarket: ValuationComparableSelectionListDto | null;
  cost: ValuationCostApproachDto | null;
  recon: ValuationReconciliationDto | null;
  settings: ValuationApproachSettingsDto | null;
}> {
  const propertyId = (property?.id ?? "").trim();
  if (!propertyId) {
    return {
      valuationRequestId: null,
      market: null,
      landMarket: null,
      cost: null,
      recon: null,
      settings: null,
    };
  }
  const open = await ensureOpenValuationRequestByProperty(config, {
    propId: propertyId,
    area: (property?.area ?? "").trim() || "—",
    type: property?.propertyType || "—",
    appraiser: "—",
  });
  if (!open.ok) {
    return {
      valuationRequestId: null,
      market: null,
      landMarket: null,
      cost: null,
      recon: null,
      settings: null,
    };
  }
  const [sel, landSel, costRes, reconRes, settingsRes] = await Promise.all([
    listValuationComparableSelections(config, open.data.id, "market"),
    listValuationComparableSelections(config, open.data.id, "land_within_cost"),
    getValuationCostApproach(config, open.data.id),
    getValuationReconciliation(config, open.data.id),
    getValuationApproachSettings(config, open.data.id),
  ]);
  return {
    valuationRequestId: open.data.id,
    market: sel.ok ? sel.data : null,
    landMarket: landSel.ok ? landSel.data : null,
    cost: costRes.ok ? costRes.data : null,
    recon: reconRes.ok ? reconRes.data : null,
    settings: settingsRes.ok ? settingsRes.data : null,
  };
}

// Stable refs — a fresh [] each render would invalidate buildReportMeta deps.
export const EMPTY_OUTPUT_CLIENTS: ClientDto[] = [];
export const EMPTY_INVENTORY_LINES: BuildingInventoryLineDto[] = [];
export const EMPTY_PHOTO_SLOTS: ValuationReportSlotAttachment[] = [];

function surveyBoundsFromPayload(
  payload: Record<string, unknown> | null | undefined,
): ValuationReportSurveyBounds | null {
  if (!payload) return null;
  const str = (key: string) =>
    typeof payload[key] === "string" ? payload[key] : "";
  const raw = payload.deedMatchesNature;
  const deedMatchesNature =
    raw === "yes" || raw === true
      ? "yes"
      : raw === "no" || raw === false
        ? "no"
        : null;
  return {
    deedMatchesNature,
    northBoundary: str("northBoundary"),
    northBoundaryLengthM: str("northBoundaryLengthM"),
    southBoundary: str("southBoundary"),
    southBoundaryLengthM: str("southBoundaryLengthM"),
    eastBoundary: str("eastBoundary"),
    eastBoundaryLengthM: str("eastBoundaryLengthM"),
    westBoundary: str("westBoundary"),
    westBoundaryLengthM: str("westBoundaryLengthM"),
    natureNorthBoundary: str("natureNorthBoundary"),
    natureNorthBoundaryLengthM: str("natureNorthBoundaryLengthM"),
    natureSouthBoundary: str("natureSouthBoundary"),
    natureSouthBoundaryLengthM: str("natureSouthBoundaryLengthM"),
    natureEastBoundary: str("natureEastBoundary"),
    natureEastBoundaryLengthM: str("natureEastBoundaryLengthM"),
    natureWestBoundary: str("natureWestBoundary"),
    natureWestBoundaryLengthM: str("natureWestBoundaryLengthM"),
  };
}

export function effectiveValuationDate(input: {
  draft: EvaluatorSubmission;
  inspector: InspectorWorkspaceDraft | null;
  settings: ValuationApproachSettingsDto | null;
}): string {
  const draftDate = input.draft.appraisalDate || input.draft.reportIssueDate;
  if (draftDate.trim()) return draftDate;
  if (input.settings?.valuationDateMode === "retrospective") {
    const start = (input.settings.retrospectiveDate ?? "").trim();
    const end = (input.settings.retrospectiveDateEnd ?? "").trim();
    if (start && end) return `${start} — ${end}`;
    return start;
  }
  return (input.inspector?.inspectionDate ?? "").trim();
}

/** Valuation report output-tab data bundle — one cacheable query:
 * switching tabs within staleTime does not re-fire 7+ requests. */
export async function loadReportOutputBundle(input: {
  property: PoPropertyIntake | null | undefined;
  poNumber: string;
  inspectionTaskId: string | null;
  surveyTaskId: string | null;
}) {
  const propertyId = (input.property?.id ?? "").trim();
  const inspectorP = input.inspectionTaskId
    ? fetchInspectorWorkspace(input.inspectionTaskId)
    : Promise.resolve(null);
  const emptyAttach = {
    photos: [] as Array<ValuationReportSlotAttachment | null>,
    survey: null as ValuationReportSlotAttachment | null,
    deed: null as ValuationReportSlotAttachment | null,
    siteMap: null as ValuationReportSlotAttachment | null,
  };
  const session = getAuthSession();
  if (!session?.token) {
    return {
      inspector: await inspectorP,
      inventoryLines: [] as BuildingInventoryLineDto[],
      lists: null,
      clients: [] as ClientDto[],
      approaches: null,
      survey: null,
      attach: emptyAttach,
    };
  }
  const config: ValuationApiConfig = {
    token: session.token,
    baseUrl: getApiBase(),
  };
  const inventoryP =
    input.poNumber && propertyId
      ? getBuildingInventory(config, input.poNumber, propertyId)
      : Promise.resolve(null);
  const labelsP = Promise.all([getValuationLists(config), listClients(config)]);
  const approachesP = loadValuationApproaches(config, input.property);
  const surveyP = input.surveyTaskId
    ? getPartyTaskSubmission(config, input.surveyTaskId)
    : Promise.resolve(null);
  // Inspection photos and the survey PDF are task-scoped — for-property never
  // sees them. Collect ids from the inspector draft + engineering submission.
  const attachmentsP = Promise.all([inspectorP, surveyP]).then(
    ([ws, surveyRes]) => {
      if (!propertyId) return emptyAttach;
      const surveyPayload =
        surveyRes && "ok" in surveyRes && surveyRes.ok
          ? (surveyRes.data.payload as Record<string, unknown>)
          : null;
      const surveyAttachmentId =
        surveyReportAttachmentIdFromPayload(surveyPayload);
      return loadValuationReportPrintAttachments(
        config,
        { poNumber: input.poNumber, propertyId },
        true,
        {
          inspectorPhotoIds: collectInspectorPhotoAttachmentIds(ws),
          surveyAttachmentIds: surveyAttachmentId
            ? [surveyAttachmentId]
            : [],
        },
      );
    },
  );
  const [ws, invRes, [listsRes, clientsRes], approaches, surveyRes, attach] =
    await Promise.all([
      inspectorP,
      inventoryP,
      labelsP,
      approachesP,
      surveyP,
      attachmentsP,
    ]);
  return {
    inspector: ws,
    inventoryLines:
      input.poNumber && propertyId && invRes?.ok
        ? invRes.data.lines ?? []
        : ([] as BuildingInventoryLineDto[]),
    lists: listsRes.ok ? listsRes.data.lists : null,
    clients: clientsRes.ok ? clientsRes.data : ([] as ClientDto[]),
    approaches,
    survey:
      surveyRes && "ok" in surveyRes && surveyRes.ok
        ? surveyBoundsFromPayload(
            surveyRes.data.payload as Record<string, unknown>,
          )
        : null,
    attach,
  };
}
