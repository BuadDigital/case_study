"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@platform/ui-kit";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import {
  VALUATION_REPORT_HTML_DEFAULTS as REPORT_DEFAULTS,
  activeValuationListOptions,
  type OrganizationSettingsDto,
} from "@platform/api-client";
import { loadInfathDeposit } from "@platform/app-shared/app-data/infath-deposit";
import { loadSpecialistFinishingLevel } from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import { isLandInspectionContext } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import { openHtmlDocumentInNewTab } from "@platform/app-shared/media/open-html-document";
import { usePoRecordQuery } from "../../lib/case-study-bridge";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import {
  fetchValuationReportV3Html,
  prefetchValuationReportTemplate,
} from "../../lib/evaluator/valuation-report-v3-preview";
import { ValuationReportLoading } from "./ValuationReportLoading";
import {
  assignmentValuationFromPo,
  buildValuationReportLiveFill,
  certifiedPracticeLicenseFromOrg,
} from "../../lib/evaluator/valuation-report-live-fill";
import {
  materializePrintMapSlots,
  printMapsNotice,
  type ComparablesMapPin,
} from "../../lib/evaluator/valuation-report-comparables-map";
import { ComparablesGoogleMap } from "./ComparablesGoogleMap";
import { ReportMissingFieldPrompt } from "./ReportMissingFieldPrompt";
import type { ReportAppraiserTab } from "../../lib/evaluator/valuation-report-missing-fields";
import {
  EMPTY_INVENTORY_LINES,
  EMPTY_OUTPUT_CLIENTS,
  EMPTY_PHOTO_SLOTS,
  arabicErrorMessage,
  effectiveValuationDate,
  ensureImageSlotCustomElement,
  finishingTextForReport,
  loadReportOutputBundle,
} from "./evaluator-report-output-helpers";

export function EvaluatorValuationReportOutputTab({
  draft,
  property,
  inspectionTaskId,
  surveyTaskId,
  assignedAppraiserName,
  assignedAppraiserId,
  onReportChoicesPatch,
  onNavigateTab,
  showActions = true,
  showMissingFields = true,
}: {
  draft: EvaluatorSubmission;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  surveyTaskId?: string | null;
  /** From work-order dispatch — printed as a fourth participants column. */
  assignedAppraiserName?: string | null;
  assignedAppraiserId?: string | null;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  /** A red appraiser field in the report opens the evaluator tab that completes it. */
  onNavigateTab?: (tab: ReportAppraiserTab) => void;
  /** False on read-only embeds (property page): no PDF link / print toolbar. */
  showActions?: boolean;
  /** False on read-only embeds (property page): no red missing-field marks or notify prompt. */
  showMissingFields?: boolean;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  // Template and organization settings don't depend on the property data — start them
  // now, beside the data bundle, instead of after it (both are cached for the build).
  useEffect(() => {
    prefetchValuationReportTemplate();
    void ensureOrganizationSettingsLoaded().catch(() => null);
  }, []);
  const [screenHtml, setScreenHtml] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const clients = EMPTY_OUTPUT_CLIENTS;
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  /** Why the last print copy fell back from Google maps (Static Maps API not enabled on the key). */
  const [mapNotice, setMapNotice] = useState<string | null>(null);
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

  // Catalog «أنواع الحد» names, so §08 «الواجهات» prints «مشاه» rather than its key.
  const boundaryTypeLabels = useMemo(
    () =>
      Object.fromEntries(
        activeValuationListOptions(outputBundle?.lists ?? undefined, "boundaryTypes").map(
          (o) => [o.value, o.label],
        ),
      ),
    [outputBundle?.lists],
  );

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
          assignedAppraiserId,
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
          boundaryTypeLabels,
          selectedSpecialAssumptions: approachSettings?.isSaved
            ? approachSettings.selectedAssumptions
            : undefined,
          externalSpecialistUsed: approachSettings?.externalSpecialistUsed,
          externalSpecialistDetails:
            approachSettings?.externalSpecialistDetails ?? null,
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
      assignedAppraiserId,
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
            markMissingFields: showMissingFields,
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
  }, [buildReportMeta, draft.poNumber, poQuery.isPending, outputQuery.isSuccess, showMissingFields]);

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

  // Screen report is read-only: show filled <image-slot> images, never browse/upload/reframe.
  useEffect(() => {
    if (!screenHtml) return;
    let cancelled = false;
    const reportRoot = document.querySelector(".rpt-ref");
    if (!reportRoot) return;

    window.__ejadahImageSlotsEditable = false;

    void ensureImageSlotCustomElement()
      .then(() => {
        if (cancelled) return;
        reportRoot.querySelectorAll("image-slot").forEach((node) => {
          const el = node as HTMLElement;
          el.removeAttribute("data-editable");
          const src = el.getAttribute("src");
          if (src) el.setAttribute("src", src);
        });
      })
      .catch(() => {
        /* preview still works without custom element upgrade */
      });

    return () => {
      cancelled = true;
      window.__ejadahImageSlotsEditable = false;
    };
  }, [screenHtml]);

  if (error && !screenHtml) {
    return <p className="m-0 text-[13px] text-[#b42318]">{error}</p>;
  }
  if (!screenHtml) return <ValuationReportLoading />;

  return (
    <div className="min-w-0">
      {showActions ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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
        ref={reportRef}
        className="rpt-ref min-w-0"
        dangerouslySetInnerHTML={{ __html: screenHtml }}
      />
      {showMissingFields ? (
        <ReportMissingFieldPrompt
          rootRef={reportRef}
          html={screenHtml}
          poNumber={draft.poNumber ?? ""}
          propertyId={property?.id ?? ""}
          onNavigateTab={onNavigateTab}
        />
      ) : null}
    </div>
  );
}
