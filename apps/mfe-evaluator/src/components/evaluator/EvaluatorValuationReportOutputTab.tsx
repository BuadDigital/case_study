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
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/app-data/inspector-workspace-reads";
import { loadInfathDeposit } from "@case-study/mfe/lib/app-data/infath-deposit-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/app-data/inspector-workspace-data";
import { isLandInspectionContext } from "@case-study/mfe/lib/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/app-data/po-intake-data";
import { openHtmlDocumentInNewTab } from "@case-study/mfe/lib/open-html-document";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { fetchValuationReportV3Html } from "../../lib/evaluator/valuation-report-v3-preview";
import {
  assignmentValuationFromPo,
  buildValuationReportLiveFill,
  type ValuationReportSurveyBounds,
} from "../../lib/evaluator/valuation-report-live-fill";
import {
  collectInspectorPhotoAttachmentIds,
  loadValuationReportPrintAttachments,
  type ValuationReportSlotAttachment,
} from "../../lib/evaluator/valuation-report-print-attachments";
import type { ComparablesMapPin } from "../../lib/evaluator/valuation-report-comparables-map";
import { ComparablesGoogleMap } from "./ComparablesGoogleMap";

type ValuationApiConfig = { token: string; baseUrl: string };

async function loadValuationApproaches(
  config: ValuationApiConfig,
  property: PoPropertyIntake | null | undefined,
): Promise<{
  market: ValuationComparableSelectionListDto | null;
  landMarket: ValuationComparableSelectionListDto | null;
  cost: ValuationCostApproachDto | null;
  recon: ValuationReconciliationDto | null;
  settings: ValuationApproachSettingsDto | null;
}> {
  const propertyId = (property?.id ?? "").trim();
  if (!propertyId) {
    return { market: null, landMarket: null, cost: null, recon: null, settings: null };
  }
  const open = await ensureOpenValuationRequestByProperty(config, {
    propId: propertyId,
    area: (property?.area ?? "").trim() || "—",
    type: property?.propertyType || "—",
    appraiser: "—",
  });
  if (!open.ok) {
    return { market: null, landMarket: null, cost: null, recon: null, settings: null };
  }
  const [sel, landSel, costRes, reconRes, settingsRes] = await Promise.all([
    listValuationComparableSelections(config, open.data.id, "market"),
    listValuationComparableSelections(config, open.data.id, "land_within_cost"),
    getValuationCostApproach(config, open.data.id),
    getValuationReconciliation(config, open.data.id),
    getValuationApproachSettings(config, open.data.id),
  ]);
  return {
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
    photos: [] as ValuationReportSlotAttachment[],
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
  // Inspection photos are tied to the task id — collected from the inspector draft and passed to the loader.
  const attachmentsP = inspectorP.then((ws) =>
    propertyId
      ? loadValuationReportPrintAttachments(config, propertyId, true, {
          inspectorPhotoIds: collectInspectorPhotoAttachmentIds(ws),
        })
      : emptyAttach,
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
}: {
  draft: EvaluatorSubmission;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  surveyTaskId?: string | null;
  /** From work-order dispatch — printed as a fourth participants column. */
  assignedAppraiserName?: string | null;
}) {
  const [screenHtml, setScreenHtml] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const clients = EMPTY_OUTPUT_CLIENTS;
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
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
      const vr = { ...REPORT_DEFAULTS, ...(loaded?.valuationReport ?? {}) };
      return {
        reportNo: draft.reportNo,
        reportDate: draft.appraisalDate || draft.reportIssueDate,
        // Deposit code: draft first, then what the Enfaz deposit screen saved for this property.
        depositCode:
          draft.depositCode || loadInfathDeposit(property?.id ?? "").depositCode,
        live: buildValuationReportLiveFill({
          draft,
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
          // No sample fallback — org settings or "—" in the report.
          certifiedName: ev.name,
          certifiedLicense: ev.licenseNumber,
          certifiedMembershipNumber: ev.membershipNumber,
          certifiedIssuedAt: ev.licenseIssuedAt,
          certifiedExpires: ev.licenseExpiresHijri,
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
          finishingLuxuryText: vr.finishingLuxury,
          finishingMediumText: vr.finishingMedium,
          finishingOrdinaryText: vr.finishingOrdinary,
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
          setError(
            err instanceof Error ? err.message : "تعذّر تحميل تقرير التقييم",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // Intentionally omit `org`: this effect loads org and builds HTML.
    // Including it re-triggered the effect after setOrg and caused a fetch loop.
  }, [buildReportMeta, draft.poNumber, poQuery.isPending, outputQuery.isSuccess]);

  const print = useCallback(async () => {
    setPrinting(true);
    try {
      const loaded = await ensureOrganizationSettingsLoaded({ force: true });
      if (loaded) setOrg(loaded);
      const html = await fetchValuationReportV3Html(
        {
          ...buildReportMeta(loaded),
          branding: loaded?.branding ?? org?.branding ?? null,
          valuers: loaded?.valuers ?? org?.valuers ?? [],
        },
        "print",
      );
      const opened = openHtmlDocumentInNewTab(html, {
        print: true,
        waitForImages: true,
        waitForFonts: true,
      });
      if (!opened) {
        setError("المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "تعذّر تجهيز نسخة الطباعة",
      );
    } finally {
      setPrinting(false);
    }
  }, [buildReportMeta, org]);

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
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={printing}
          onClick={() => void print()}
        >
          {printing ? "جاري التجهيز…" : "طباعة / PDF"}
        </Button>
      </div>
      {error ? (
        <p className="mb-3 mt-0 text-[13px] text-[#b42318]">{error}</p>
      ) : null}
      <div
        className="rpt-ref min-w-0"
        dangerouslySetInnerHTML={{ __html: screenHtml }}
      />
    </div>
  );
}
