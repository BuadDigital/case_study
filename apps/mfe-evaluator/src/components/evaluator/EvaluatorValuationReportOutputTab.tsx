"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useQuery } from "@tanstack/react-query";
import { Button, Spinner } from "@platform/ui-kit";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
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
  createValuationReportPdf,
  valuationReportPdfAbsoluteUrl,
  type ValuationReportPdfLinkDto,
  type ValuationReportPdfResult,
  VALUATION_REPORT_HTML_DEFAULTS as REPORT_DEFAULTS,
  type BuildingInventoryLineDto,
  type ClientDto,
  type OrganizationSettingsDto,
  type ValuationApproachSettingsDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { fetchInspectorWorkspace } from "../../lib/case-study-bridge";
import { loadInfathDeposit } from "@platform/app-shared/app-data/infath-deposit-storage";
import { loadSpecialistFinishingLevel } from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { isLandInspectionContext } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import { openHtmlDocumentInNewTab } from "@platform/app-shared/media/open-html-document";
import { usePoRecordQuery } from "../../lib/case-study-bridge";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import { fetchValuationReportV3Html } from "../../lib/evaluator/valuation-report-v3-preview";
import {
  assignmentValuationFromPo,
  buildValuationReportLiveFill,
  certifiedPracticeLicenseFromOrg,
  type ValuationReportSurveyBounds,
} from "../../lib/evaluator/valuation-report-live-fill";
import {
  collectInspectorPhotoAttachmentIds,
  loadValuationReportPrintAttachments,
  surveyReportAttachmentIdFromPayload,
  type ValuationReportSlotAttachment,
} from "../../lib/evaluator/valuation-report-print-attachments";
import {
  materializePrintMapSlots,
  printMapsNotice,
  type ComparablesMapPin,
} from "../../lib/evaluator/valuation-report-comparables-map";
import { inlinePrintHtmlAssets } from "../../lib/evaluator/valuation-report-print-assets";
import { ComparablesGoogleMap } from "./ComparablesGoogleMap";

type ValuationApiConfig = { token: string; baseUrl: string };

declare global {
  interface Window {
    __ejadahImageSlotsEditable?: boolean;
    omelette?: {
      writeFile?: (path: string, content: string) => void | Promise<void>;
    };
  }
}

let imageSlotScriptPromise: Promise<void> | null = null;

function ensureImageSlotCustomElement(): Promise<void> {
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
export function arabicErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && /[؀-ۿ]/.test(err.message)) return err.message;
  if (err instanceof Error) console.warn("[evaluator] report output tab error:", err);
  return fallback;
}

/** Appraiser-facing text for a failed `.pdf?k=…` link request. */
export function pdfLinkErrorMessage(
  res: Exclude<ValuationReportPdfResult, { ok: true }>,
): string {
  switch (res.kind) {
    case "auth":
      return "انتهت الجلسة — سجّل الدخول من جديد ثم أعد المحاولة.";
    case "forbidden":
      return "لا تملك صلاحية إنشاء رابط PDF لهذا التقرير.";
    case "not_found":
      return "طلب التقييم غير موجود.";
    case "too_large":
      return "حجم التقرير كبير جداً — قلّل عدد الصور المرفقة ثم أعد المحاولة.";
    case "invalid":
    case "renderer_unavailable":
    case "render_failed":
      return res.message || "تعذّر إنشاء رابط PDF — حاول مرة أخرى.";
    default:
      return "تعذّر إنشاء رابط PDF — حاول مرة أخرى.";
  }
}

/** Old shortened defaults — replace with HTML v3 full copy when still stored in org settings. */
const LEGACY_SHORT_FINISHING = new Set([
  "واجهات حجر طبيعي أو دهان عالي الجودة، أرضيات مداخل ومجالس من رخام فاخر، عزل ونوافذ عالية، تكييف مركزي ومصعد.",
  "واجهات حجر أو دهان، أرضيات سيراميك، تكييف منفصل (سبليت)، مكونات جدران مزدوجة.",
  "واجهات دهان، أرضيات سيراميك عادي أو بلاط بلدي، شبابيك عادية، تكييف شباك، بدون جبس أسقف.",
]);

function finishingTextForReport(stored: string, htmlV3Default: string): string {
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
const EMPTY_OUTPUT_CLIENTS: ClientDto[] = [];
const EMPTY_INVENTORY_LINES: BuildingInventoryLineDto[] = [];
const EMPTY_PHOTO_SLOTS: ValuationReportSlotAttachment[] = [];

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

function effectiveValuationDate(input: {
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
async function loadReportOutputBundle(input: {
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


export function EvaluatorValuationReportOutputTab({
  draft,
  property,
  inspectionTaskId,
  surveyTaskId,
  assignedAppraiserName,
  onReportChoicesPatch,
}: {
  draft: EvaluatorSubmission;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  surveyTaskId?: string | null;
  /** From work-order dispatch — printed as a fourth participants column. */
  assignedAppraiserName?: string | null;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
}) {
  const [screenHtml, setScreenHtml] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const clients = EMPTY_OUTPUT_CLIENTS;
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  /** Why the last print copy fell back from Google maps (Static Maps API not enabled on the key). */
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  /** Last rendered `.pdf?k=…` link for this report (server-side PDF of the print copy). */
  const [pdfLink, setPdfLink] = useState<ValuationReportPdfLinkDto | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfCopied, setPdfCopied] = useState(false);
  const poQuery = usePoRecordQuery(draft.poNumber);
  const record = poQuery.data;
  const poKeys = assignmentValuationFromPo(record);

  const outputQuery = useQuery({
    queryKey: [
      "evaluator-report-output",
      property?.id ?? "",
      draft.poNumber,
      inspectionTaskId ?? "",
      surveyTaskId ?? "",
    ],
    queryFn: () =>
      loadReportOutputBundle({
        property,
        poNumber: draft.poNumber,
        inspectionTaskId: inspectionTaskId ?? null,
        surveyTaskId: surveyTaskId ?? null,
      }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
  const outputBundle = outputQuery.data;

  // Derive directly from the bundle — previously 12 state mirrors from one effect, and a new
  // listLabels object each time invalidated buildReportMeta and built the report twice
  // (rerender-derived-state-no-effect).
  const inspector = outputBundle?.inspector ?? null;
  const inventoryLines = outputBundle?.inventoryLines ?? EMPTY_INVENTORY_LINES;
  const market = outputBundle?.approaches?.market ?? null;
  const landMarket = outputBundle?.approaches?.landMarket ?? null;
  const cost = outputBundle?.approaches?.cost ?? null;
  const recon = outputBundle?.approaches?.recon ?? null;
  const approachSettings = outputBundle?.approaches?.settings ?? null;
  const survey = outputBundle?.survey ?? null;
  const surveySlot = outputBundle?.attach.survey ?? null;
  const deedSlot = outputBundle?.attach.deed ?? null;
  const siteMapSlot = outputBundle?.attach.siteMap ?? null;

  const listLabels = useMemo(() => {
    const lists = outputBundle?.lists;
    if (!lists) {
      return {} as {
        purpose?: string;
        basis?: string;
        premise?: string;
        basisDefinition?: string;
      };
    }
    const find = (kind: string, key: string) =>
      (lists[kind] ?? []).find((it) => it.isEnabled && it.key === key);
    const purpose = find("purposes", poKeys.purposeKey);
    const basis = find("valueBases", poKeys.valueBasisKey);
    const premise = find("premises", poKeys.premiseKey);
    return {
      purpose: purpose?.name,
      basis: basis?.name,
      premise: premise?.name,
      basisDefinition: (basis?.cells[0] ?? "").trim(),
    };
  }, [
    outputBundle,
    poKeys.premiseKey,
    poKeys.purposeKey,
    poKeys.valueBasisKey,
  ]);

  const photoSlots = useMemo(() => {
    const attach = outputBundle?.attach;
    if (!attach) return EMPTY_PHOTO_SLOTS;
    const land = isLandInspectionContext({
      vacantLand: outputBundle.inspector?.vacantLand,
      assetSubject: outputBundle.inspector?.featureValues?.assetSubject,
      classification: property?.classification,
      propertyType: property?.propertyType,
    });
    return land && attach.photos.length > 6
      ? attach.photos.slice(0, 6)
      : attach.photos;
  }, [outputBundle, property?.classification, property?.propertyType]);

  /** Shared report request body for on-screen preview and print — was fully duplicated (~70 lines). */
  const buildReportMeta = useCallback(
    (loaded: Awaited<ReturnType<typeof ensureOrganizationSettingsLoaded>>) => {
      const ev = loaded?.evaluator ?? {};
      const company = loaded?.company ?? {};
      const practice = certifiedPracticeLicenseFromOrg({ company, evaluator: ev });
      const vr = { ...REPORT_DEFAULTS, ...(loaded?.valuationReport ?? {}) };
      const specialistFinishing = loadSpecialistFinishingLevel(
        property?.id ?? draft.propertyId,
      );
      return {
        reportNo: draft.reportNo,
        reportDate: draft.appraisalDate || draft.reportIssueDate,
        // Deposit code: draft first, then what the Enfaz deposit screen saved for this property.
        depositCode:
          draft.depositCode || loadInfathDeposit(property?.id ?? "").depositCode,
        live: buildValuationReportLiveFill({
          draft,
          costApproachEnabled: Boolean(
            approachSettings?.isSaved &&
              approachSettings.costApproachEnabled &&
              (approachSettings.costApproachAllowed ?? true),
          ),
          costScopeKey: approachSettings?.costScopeKey,
          costBasisKey: approachSettings?.costBasisKey,
          record,
          property,
          inspector,
          inventoryLines,
          market,
          landMarket,
          cost,
          recon,
          clients,
          purposeLabel: listLabels.purpose,
          basisLabel: listLabels.basis,
          premiseLabel: listLabels.premise,
          basisDefinition: listLabels.basisDefinition,
          // Firm practice license from بيانات المنشأة — no sample fallback.
          certifiedName: ev.name,
          certifiedLicense: practice.number,
          certifiedMembershipNumber: ev.membershipNumber,
          certifiedIssuedAt: practice.issuedAt,
          certifiedExpires: practice.expiresAt,
          certifiedMembershipCategory: ev.membershipCategory,
          certifiedTitle: ev.title,
          certifiedMembershipExpires: ev.membershipExpiresAt,
          valuationBranch: vr.valuationBranch,
          reportType: vr.reportType,
          currency: vr.currency,
          effectiveValuationDate: effectiveValuationDate({
            draft,
            inspector,
            settings: approachSettings,
          }),
          assignedAppraiserName,
          survey,
          photoSlots: isLandInspectionContext({
            vacantLand: inspector?.vacantLand,
            assetSubject: inspector?.featureValues?.assetSubject,
            classification: property?.classification,
            propertyType: property?.propertyType,
          })
            ? photoSlots.slice(0, 6)
            : photoSlots,
          surveySlot,
          deedSlot,
          siteMapSlot,
          ivsStandardsText: vr.ivsStandards,
          glossaryText: vr.glossary,
          researchScopeText: vr.researchScopeText,
          selectedSpecialAssumptions: approachSettings?.isSaved
            ? approachSettings.selectedAssumptions
            : undefined,
          externalSpecialistUsed: approachSettings?.externalSpecialistUsed,
          finishingLuxuryText: finishingTextForReport(
            vr.finishingLuxury,
            REPORT_DEFAULTS.finishingLuxury,
          ),
          finishingMediumText: finishingTextForReport(
            vr.finishingMedium,
            REPORT_DEFAULTS.finishingMedium,
          ),
          finishingOrdinaryText: finishingTextForReport(
            vr.finishingOrdinary,
            REPORT_DEFAULTS.finishingOrdinary,
          ),
          finishingLevel: specialistFinishing,
          keyInputsText: vr.keyInputsText,
          professionalStandardsText: vr.professionalStandards,
          independenceText: vr.independence,
          termsText: vr.terms,
          restrictionsText: vr.restrictions,
        }),
      };
    },
    [
      approachSettings,
      assignedAppraiserName,
      clients,
      cost,
      deedSlot,
      draft,
      inspector,
      inventoryLines,
      landMarket,
      listLabels,
      market,
      photoSlots,
      property,
      recon,
      record,
      siteMapSlot,
      survey,
      surveySlot,
    ],
  );


  useEffect(() => {
    if (draft.poNumber && poQuery.isPending) return;
    // Do not build the report before the output bundle arrives — previously built empty
    // then fully rebuilt when data arrived (async-cheap-condition-before-await).
    if (!outputQuery.isSuccess) return;
    let cancelled = false;
    setError(null);
    // Use the shared cache — do not force-refetch (that caused a request storm).
    void ensureOrganizationSettingsLoaded()
      .then((loaded) => {
        if (cancelled) return null;
        if (loaded) setOrg(loaded);
        return fetchValuationReportV3Html(
          {
            ...buildReportMeta(loaded),
            branding: loaded?.branding ?? null,
            valuers: loaded?.valuers ?? [],
          },
          "screen",
        );
      })
      .then((next) => {
        if (!cancelled && next != null) setScreenHtml(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(arabicErrorMessage(err, "تعذّر تحميل تقرير التقييم"));
        }
      });
    return () => {
      cancelled = true;
    };
    // Intentionally omit `org`: this effect loads org and builds HTML.
    // Including it re-triggered the effect after setOrg and caused a fetch loop.
  }, [buildReportMeta, draft.poNumber, poQuery.isPending, outputQuery.isSuccess]);

  /** Print copy: report meta + §18/§33 Static Maps images, exactly as the browser prints it. */
  const preparePrintHtml = useCallback(
    async (loaded: OrganizationSettingsDto | null) => {
      const baseMeta = buildReportMeta(loaded);
      let live = baseMeta.live;
      if (live) {
        // Print cannot run Google Maps JS — fetch Static Maps images for §18 / §33 instead.
        const { diagnostics, ...mapSlots } = await materializePrintMapSlots({
          pins: live.comparablesMapPins ?? [],
          comparableMapSlot: live.comparableMapSlot,
          satelliteMapSlot: live.satelliteMapSlot,
          closeupMapSlot: live.closeupMapSlot,
        });
        live = { ...live, ...mapSlots };
        // Google's refusal text names the missing API — keep it in the console for ops.
        if (diagnostics.denialReason && !diagnostics.googleAvailable) {
          console.warn(
            "[valuation-report] Google Static Maps refused:",
            diagnostics.denialReason,
          );
        }
        setMapNotice(printMapsNotice(diagnostics));
      }
      const html = await fetchValuationReportV3Html(
        {
          ...baseMeta,
          live,
          branding: loaded?.branding ?? org?.branding ?? null,
          valuers: loaded?.valuers ?? org?.valuers ?? [],
        },
        "print",
      );
      return { html, reportNo: (baseMeta.reportNo ?? "").trim() };
    },
    [buildReportMeta, org],
  );

  const print = useCallback(async () => {
    // Open the tab now, inside the click's transient activation: the Static Maps fetches
    // below can take a few seconds and a late window.open would be blocked as a popup.
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError("المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
      return;
    }
    setPrinting(true);
    try {
      const loaded = await ensureOrganizationSettingsLoaded({ force: true });
      if (loaded) setOrg(loaded);
      const { html } = await preparePrintHtml(loaded);
      openHtmlDocumentInNewTab(html, {
        print: true,
        waitForImages: true,
        waitForFonts: false,
        target: tab,
      });
    } catch (err: unknown) {
      tab.close();
      setError(arabicErrorMessage(err, "تعذّر تجهيز نسخة الطباعة"));
    } finally {
      setPrinting(false);
    }
  }, [preparePrintHtml]);

  const pdfRequestId = outputBundle?.approaches?.valuationRequestId ?? null;

  /**
   * Server-rendered PDF behind a shareable `…/{reportNo}.pdf?k=…` link: the same print
   * HTML, made self-contained (assets as data URLs), converted by the valuation service.
   */
  const createPdfLink = useCallback(async () => {
    const session = getAuthSession();
    if (!pdfRequestId || !session?.token) {
      setError("لا يمكن إنشاء رابط PDF قبل فتح طلب التقييم لهذا العقار.");
      return;
    }
    // Open the tab synchronously (popup blockers) and navigate it once the PDF exists.
    const tab = window.open("about:blank", "_blank");
    setPdfBusy(true);
    setPdfCopied(false);
    try {
      const loaded = await ensureOrganizationSettingsLoaded({ force: true });
      if (loaded) setOrg(loaded);
      const { html, reportNo } = await preparePrintHtml(loaded);
      const selfContained = await inlinePrintHtmlAssets(html, {
        token: session.token,
        apiBase: getApiBase(),
      });
      const res = await createValuationReportPdf(
        { token: session.token, baseUrl: getApiBase() },
        pdfRequestId,
        { html: selfContained, reportNumber: reportNo },
      );
      if (!res.ok) {
        tab?.close();
        setError(pdfLinkErrorMessage(res));
        return;
      }
      setPdfLink(res.data);
      setError(null);
      const url = valuationReportPdfAbsoluteUrl(res.data);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err: unknown) {
      tab?.close();
      setError(arabicErrorMessage(err, "تعذّر إنشاء رابط PDF"));
    } finally {
      setPdfBusy(false);
    }
  }, [pdfRequestId, preparePrintHtml]);

  const copyPdfLink = useCallback(async () => {
    if (!pdfLink) return;
    const url = valuationReportPdfAbsoluteUrl(pdfLink);
    try {
      await navigator.clipboard.writeText(url);
      setPdfCopied(true);
      window.setTimeout(() => setPdfCopied(false), 2500);
    } catch {
      window.prompt("انسخ الرابط:", url);
    }
  }, [pdfLink]);

  useEffect(() => {
    if (!screenHtml) return;
    const reportRoot = document.querySelector(".rpt-ref");
    if (!reportRoot) return;

    const hostNodes = [
      ...reportRoot.querySelectorAll<HTMLElement>("[data-ejada-gmap]"),
    ];
    const roots: Root[] = [];

    for (const host of hostNodes) {
      const mount =
        host.querySelector<HTMLElement>(".ejada-gmap-mount") ?? host;
      let pins: ComparablesMapPin[] = [];
      try {
        pins = JSON.parse(
          host.getAttribute("data-pins") || "[]",
        ) as ComparablesMapPin[];
      } catch {
        pins = [];
      }
      if (!pins.length) continue;

      const lat = Number(host.getAttribute("data-lat"));
      const lng = Number(host.getAttribute("data-lng"));
      const zoomAttr = host.getAttribute("data-zoom");
      const zoom =
        zoomAttr != null && zoomAttr !== "" ? Number(zoomAttr) : undefined;
      const mapTypeAttr = host.getAttribute("data-map-type");
      const mapTypeId =
        mapTypeAttr === "satellite" ||
        mapTypeAttr === "roadmap" ||
        mapTypeAttr === "terrain" ||
        mapTypeAttr === "hybrid"
          ? mapTypeAttr
          : "hybrid";

      const root = createRoot(mount);
      root.render(
        <ComparablesGoogleMap
          pins={pins}
          zoom={Number.isFinite(zoom) ? zoom : undefined}
          mapTypeId={mapTypeId}
          centerLat={Number.isFinite(lat) ? lat : undefined}
          centerLng={Number.isFinite(lng) ? lng : undefined}
        />,
      );
      roots.push(root);
    }
    return () => {
      // Defer: unmounting createRoot during an in-flight React render races
      // with dangerouslySetInnerHTML replacing the host nodes.
      const pending = roots.splice(0, roots.length);
      queueMicrotask(() => {
        for (const root of pending) {
          try {
            root.unmount();
          } catch {
            /* host already detached */
          }
        }
      });
    };
  }, [screenHtml]);

  // Enable HTML image-slot Edit / pan / scale in the report preview (same as valuation-report-v3.html).
  useEffect(() => {
    if (!screenHtml) return;
    let cancelled = false;
    const reportRoot = document.querySelector(".rpt-ref");
    if (!reportRoot) return;

    window.__ejadahImageSlotsEditable = true;
    const prevWrite = window.omelette?.writeFile;
    window.omelette = {
      ...(window.omelette ?? {}),
      writeFile: (path, content) => {
        if (String(path).includes("image-slots.state")) {
          try {
            const parsed = JSON.parse(content) as Record<
              string,
              string | { u?: string; s?: number; x?: number; y?: number }
            >;
            const nextFrames: Record<string, { s: number; x: number; y: number }> =
              {
                ...(draft.reportChoices?.reportSlotFrames ?? {}),
              };
            for (const [id, value] of Object.entries(parsed)) {
              if (!value || typeof value === "string") continue;
              nextFrames[id] = {
                s: typeof value.s === "number" ? value.s : 1,
                x: typeof value.x === "number" ? value.x : 0,
                y: typeof value.y === "number" ? value.y : 0,
              };
            }
            onReportChoicesPatch?.({ reportSlotFrames: nextFrames });
          } catch {
            /* ignore malformed sidecar writes */
          }
          return;
        }
        return prevWrite?.(path, content);
      },
    };

    void ensureImageSlotCustomElement()
      .then(() => {
        if (cancelled) return;
        // Re-run attributeChanged / connected logic after upgrade.
        reportRoot.querySelectorAll("image-slot").forEach((node) => {
          const el = node as HTMLElement & { attributeChangedCallback?: unknown };
          // Nudge upgrade: toggle a data attr so filled slots re-apply view.
          const src = el.getAttribute("src");
          if (src) {
            el.setAttribute("src", src);
          }
        });
      })
      .catch(() => {
        /* preview still works without reframe */
      });

    return () => {
      cancelled = true;
      window.__ejadahImageSlotsEditable = false;
      if (window.omelette) {
        if (prevWrite) window.omelette.writeFile = prevWrite;
        else delete window.omelette.writeFile;
      }
    };
  }, [
    screenHtml,
    draft.reportChoices?.reportSlotFrames,
    onReportChoicesPatch,
  ]);

  if (error && !screenHtml) {
    return <p className="m-0 text-[13px] text-[#b42318]">{error}</p>;
  }
  if (!screenHtml) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-text-3">
        <Spinner />
        <span>جاري تجهيز تقرير التقييم…</span>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pdfBusy || printing || !pdfRequestId}
          title="ينشئ ملف PDF على الخادم ويفتحه من رابط ينتهي بـ .pdf يمكن مشاركته"
          onClick={() => void createPdfLink()}
        >
          {pdfBusy ? "جاري إنشاء PDF…" : "رابط PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={printing || pdfBusy}
          onClick={() => void print()}
        >
          {printing ? "جاري التجهيز…" : "طباعة / PDF"}
        </Button>
      </div>
      {pdfLink ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-[#e6e1d6] bg-[#faf8f3] px-3 py-2 text-[12px] text-[#3a3f4d]"
          data-testid="report-pdf-link"
        >
          <span className="font-semibold text-[#102b4e]">{pdfLink.fileName}</span>
          <input
            readOnly
            dir="ltr"
            value={valuationReportPdfAbsoluteUrl(pdfLink)}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-[240px] flex-1 rounded border border-[#ddd8cc] bg-white px-2 py-1 text-[11px] text-[#3a3f4d]"
            aria-label="رابط ملف PDF"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyPdfLink()}
          >
            {pdfCopied ? "تم النسخ" : "نسخ الرابط"}
          </Button>
          <a
            href={valuationReportPdfAbsoluteUrl(pdfLink)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#102b4e] underline"
          >
            فتح
          </a>
          <span className="text-text-3">
            صالح حتى {pdfLink.expiresAtUtc.slice(0, 10)}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="mb-3 mt-0 text-[13px] text-[#b42318]">{error}</p>
      ) : null}
      {mapNotice ? (
        <p
          className="mb-3 mt-0 text-[12px] leading-relaxed text-[#8a5a00]"
          data-testid="report-map-notice"
        >
          {mapNotice}
        </p>
      ) : null}
      <div
        className="rpt-ref min-w-0"
        dangerouslySetInnerHTML={{ __html: screenHtml }}
      />
    </div>
  );
}
