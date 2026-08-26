"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner } from "@platform/ui-kit";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import {
  CERTIFIED_VALUER_HTML_DEFAULTS,
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
  type OrganizationBrandingSettings,
  type OrganizationValuerRosterEntry,
  type ValuationApproachSettingsDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import { isLandInspectionContext } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { fetchValuationReportV3Html } from "../../lib/evaluator/valuation-report-v3-preview";
import {
  assignmentValuationFromPo,
  buildValuationReportLiveFill,
  type ValuationReportSurveyBounds,
} from "../../lib/evaluator/valuation-report-live-fill";
import {
  loadValuationReportPrintAttachments,
  type ValuationReportSlotAttachment,
} from "../../lib/evaluator/valuation-report-print-attachments";

type ValuationApiConfig = { token: string; baseUrl: string };

async function loadValuationApproaches(
  config: ValuationApiConfig,
  property: PoPropertyIntake | null | undefined,
): Promise<{
  market: ValuationComparableSelectionListDto | null;
  cost: ValuationCostApproachDto | null;
  recon: ValuationReconciliationDto | null;
  settings: ValuationApproachSettingsDto | null;
}> {
  const propertyId = (property?.id ?? "").trim();
  if (!propertyId) {
    return { market: null, cost: null, recon: null, settings: null };
  }
  const open = await ensureOpenValuationRequestByProperty(config, {
    propId: propertyId,
    area: (property?.area ?? "").trim() || "—",
    type: property?.propertyType || "—",
    appraiser: "—",
  });
  if (!open.ok) {
    return { market: null, cost: null, recon: null, settings: null };
  }
  const [sel, costRes, reconRes, settingsRes] = await Promise.all([
    listValuationComparableSelections(config, open.data.id),
    getValuationCostApproach(config, open.data.id),
    getValuationReconciliation(config, open.data.id),
    getValuationApproachSettings(config, open.data.id),
  ]);
  return {
    market: sel.ok ? sel.data : null,
    cost: costRes.ok ? costRes.data : null,
    recon: reconRes.ok ? reconRes.data : null,
    settings: settingsRes.ok ? settingsRes.data : null,
  };
}

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
    return (input.settings.retrospectiveDate ?? "").trim();
  }
  return (input.inspector?.inspectionDate ?? "").trim();
}

export function EvaluatorValuationReportOutputTab({
  draft,
  property,
  inspectionTaskId,
  surveyTaskId,
}: {
  draft: EvaluatorSubmission;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  surveyTaskId?: string | null;
}) {
  const [screenHtml, setScreenHtml] = useState<string | null>(null);
  const [branding, setBranding] = useState<OrganizationBrandingSettings | null>(
    null,
  );
  const [valuers, setValuers] = useState<OrganizationValuerRosterEntry[]>([]);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [inspector, setInspector] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [inventoryLines, setInventoryLines] = useState<
    BuildingInventoryLineDto[]
  >([]);
  const [market, setMarket] =
    useState<ValuationComparableSelectionListDto | null>(null);
  const [cost, setCost] = useState<ValuationCostApproachDto | null>(null);
  const [recon, setRecon] = useState<ValuationReconciliationDto | null>(null);
  const [approachSettings, setApproachSettings] =
    useState<ValuationApproachSettingsDto | null>(null);
  const [survey, setSurvey] = useState<ValuationReportSurveyBounds | null>(
    null,
  );
  const [photoSlots, setPhotoSlots] = useState<ValuationReportSlotAttachment[]>(
    [],
  );
  const [surveySlot, setSurveySlot] =
    useState<ValuationReportSlotAttachment | null>(null);
  const [deedSlot, setDeedSlot] =
    useState<ValuationReportSlotAttachment | null>(null);
  const [siteMapSlot, setSiteMapSlot] =
    useState<ValuationReportSlotAttachment | null>(null);
  const [ivsStandardsText, setIvsStandardsText] = useState("");
  const [glossaryText, setGlossaryText] = useState("");
  const [researchScopeText, setResearchScopeText] = useState("");
  const [specialAssumptionLibrary, setSpecialAssumptionLibrary] = useState<
    string[]
  >([]);
  const [finishingLuxuryText, setFinishingLuxuryText] = useState("");
  const [finishingMediumText, setFinishingMediumText] = useState("");
  const [finishingOrdinaryText, setFinishingOrdinaryText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const printUrlRef = useRef<string | null>(null);
  const poQuery = usePoRecordQuery(draft.poNumber);
  const record = poQuery.data;
  const poKeys = assignmentValuationFromPo(record);
  const [listLabels, setListLabels] = useState<{
    purpose?: string;
    basis?: string;
    premise?: string;
    basisDefinition?: string;
  }>({});

  useEffect(() => {
    let cancelled = false;
    const propertyId = (property?.id ?? "").trim();
    const inspectorP = inspectionTaskId
      ? fetchInspectorWorkspace(inspectionTaskId)
      : Promise.resolve(null);

    const session = getAuthSession();
    if (!session?.token) {
      void inspectorP.then((ws) => {
        if (!cancelled) setInspector(ws);
      });
      return () => {
        cancelled = true;
      };
    }

    const config: ValuationApiConfig = {
      token: session.token,
      baseUrl: getApiBase(),
    };
    const inventoryP =
      draft.poNumber && propertyId
        ? getBuildingInventory(config, draft.poNumber, propertyId)
        : Promise.resolve(null);
    const labelsP = Promise.all([
      getValuationLists(config),
      listClients(config),
    ]);
    const approachesP = loadValuationApproaches(config, property);
    const surveyP = surveyTaskId
      ? getPartyTaskSubmission(config, surveyTaskId)
      : Promise.resolve(null);
    const attachmentsP = propertyId
      ? loadValuationReportPrintAttachments(config, propertyId, true)
      : Promise.resolve({
          photos: [] as ValuationReportSlotAttachment[],
          survey: null as ValuationReportSlotAttachment | null,
          deed: null as ValuationReportSlotAttachment | null,
          siteMap: null as ValuationReportSlotAttachment | null,
        });

    void Promise.all([
      inspectorP,
      inventoryP,
      labelsP,
      approachesP,
      surveyP,
      attachmentsP,
    ]).then(
      ([ws, invRes, [listsRes, clientsRes], approaches, surveyRes, attach]) => {
        if (cancelled) return;
        setInspector(ws);
        if (draft.poNumber && propertyId) {
          if (invRes?.ok) setInventoryLines(invRes.data.lines ?? []);
        } else {
          setInventoryLines([]);
        }
        if (clientsRes.ok) setClients(clientsRes.data);
        if (listsRes.ok) {
          const lists = listsRes.data.lists;
          const find = (kind: string, key: string) =>
            (lists[kind] ?? []).find((i) => i.isEnabled && i.key === key);
          const purpose = find("purposes", poKeys.purposeKey);
          const basis = find("valueBases", poKeys.valueBasisKey);
          const premise = find("premises", poKeys.premiseKey);
          setListLabels({
            purpose: purpose?.name,
            basis: basis?.name,
            premise: premise?.name,
            basisDefinition: (basis?.cells[0] ?? "").trim(),
          });
        }
        setMarket(approaches.market);
        setCost(approaches.cost);
        setRecon(approaches.recon);
        setApproachSettings(approaches.settings);
        setSurvey(
          surveyRes && "ok" in surveyRes && surveyRes.ok
            ? surveyBoundsFromPayload(
                surveyRes.data.payload as Record<string, unknown>,
              )
            : null,
        );
        const land = isLandInspectionContext({
          vacantLand: ws?.vacantLand,
          assetSubject: ws?.featureValues?.assetSubject,
          classification: property?.classification,
          propertyType: property?.propertyType,
        });
        // Re-fetch with accurate structure budget when inspector arrives as land.
        if (land && attach.photos.length > 6) {
          setPhotoSlots(attach.photos.slice(0, 6));
        } else {
          setPhotoSlots(attach.photos);
        }
        setSurveySlot(attach.survey);
        setDeedSlot(attach.deed);
        setSiteMapSlot(attach.siteMap);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    draft.poNumber,
    inspectionTaskId,
    poKeys.premiseKey,
    poKeys.purposeKey,
    poKeys.valueBasisKey,
    property?.area,
    property?.id,
    property?.propertyType,
    surveyTaskId,
  ]);

  const live = useMemo(() => {
    const htmlEv = CERTIFIED_VALUER_HTML_DEFAULTS;
    const land = isLandInspectionContext({
      vacantLand: inspector?.vacantLand,
      assetSubject: inspector?.featureValues?.assetSubject,
      classification: property?.classification,
      propertyType: property?.propertyType,
    });
    return buildValuationReportLiveFill({
      draft,
      record,
      property,
      inspector,
      inventoryLines,
      market,
      cost,
      recon,
      clients,
      purposeLabel: listLabels.purpose,
      basisLabel: listLabels.basis,
      premiseLabel: listLabels.premise,
      basisDefinition: listLabels.basisDefinition,
      certifiedName: htmlEv.name,
      certifiedLicense: htmlEv.licenseNumber,
      certifiedMembershipNumber: htmlEv.membershipNumber,
      certifiedIssuedAt: htmlEv.licenseIssuedAt,
      certifiedExpires: htmlEv.licenseExpiresHijri,
      certifiedMembershipCategory: htmlEv.membershipCategory,
      certifiedTitle: htmlEv.title,
      certifiedMembershipExpires: htmlEv.membershipExpiresAt,
      reportType: REPORT_DEFAULTS.reportType,
      currency: REPORT_DEFAULTS.currency,
      effectiveValuationDate: effectiveValuationDate({
        draft,
        inspector,
        settings: approachSettings,
      }),
      survey,
      photoSlots: land ? photoSlots.slice(0, 6) : photoSlots,
      surveySlot,
      deedSlot,
      siteMapSlot,
      ivsStandardsText,
      glossaryText,
      researchScopeText,
      specialAssumptionLibrary,
      finishingLuxuryText,
      finishingMediumText,
      finishingOrdinaryText,
    });
  }, [
    approachSettings,
    clients,
    cost,
    deedSlot,
    draft,
    finishingLuxuryText,
    finishingMediumText,
    finishingOrdinaryText,
    glossaryText,
    inspector,
    inventoryLines,
    ivsStandardsText,
    listLabels,
    market,
    photoSlots,
    property,
    recon,
    record,
    researchScopeText,
    siteMapSlot,
    specialAssumptionLibrary,
    survey,
    surveySlot,
  ]);

  const meta = useMemo(
    () => ({
      reportNo: draft.reportNo,
      reportDate: draft.appraisalDate || draft.reportIssueDate,
      depositCode: draft.depositCode,
      live,
    }),
    [draft.appraisalDate, draft.depositCode, draft.reportIssueDate, draft.reportNo, live],
  );

  useEffect(() => {
    if (draft.poNumber && poQuery.isPending) return;
    let cancelled = false;
    setError(null);
    void ensureOrganizationSettingsLoaded({ force: true })
      .then((org) => {
        const next = org?.branding ?? null;
        const roster = org?.valuers ?? [];
        const ev = org?.evaluator ?? {};
        const vr = { ...REPORT_DEFAULTS, ...(org?.valuationReport ?? {}) };
        if (!cancelled) {
          setBranding(next);
          setValuers(roster);
          setIvsStandardsText(vr.ivsStandards ?? "");
          setGlossaryText(vr.glossary ?? "");
          setResearchScopeText(vr.researchScopeText ?? "");
          setSpecialAssumptionLibrary(vr.specialAssumptionLibrary ?? []);
          setFinishingLuxuryText(vr.finishingLuxury ?? "");
          setFinishingMediumText(vr.finishingMedium ?? "");
          setFinishingOrdinaryText(vr.finishingOrdinary ?? "");
        }
        const filledLive = buildValuationReportLiveFill({
          draft,
          record,
          property,
          inspector,
          inventoryLines,
          market,
          cost,
          recon,
          clients,
          purposeLabel: listLabels.purpose,
          basisLabel: listLabels.basis,
          premiseLabel: listLabels.premise,
          basisDefinition: listLabels.basisDefinition,
          certifiedName: ev.name || CERTIFIED_VALUER_HTML_DEFAULTS.name,
          certifiedLicense:
            ev.licenseNumber || CERTIFIED_VALUER_HTML_DEFAULTS.licenseNumber,
          certifiedMembershipNumber:
            ev.membershipNumber ||
            CERTIFIED_VALUER_HTML_DEFAULTS.membershipNumber,
          certifiedIssuedAt:
            ev.licenseIssuedAt || CERTIFIED_VALUER_HTML_DEFAULTS.licenseIssuedAt,
          certifiedExpires:
            ev.licenseExpiresHijri ||
            CERTIFIED_VALUER_HTML_DEFAULTS.licenseExpiresHijri,
          certifiedMembershipCategory:
            ev.membershipCategory ||
            CERTIFIED_VALUER_HTML_DEFAULTS.membershipCategory,
          certifiedTitle: ev.title || CERTIFIED_VALUER_HTML_DEFAULTS.title,
          certifiedMembershipExpires:
            ev.membershipExpiresAt ||
            CERTIFIED_VALUER_HTML_DEFAULTS.membershipExpiresAt,
          valuationBranch: vr.valuationBranch,
          reportType: vr.reportType,
          currency: vr.currency,
          effectiveValuationDate: effectiveValuationDate({
            draft,
            inspector,
            settings: approachSettings,
          }),
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
          specialAssumptionLibrary: vr.specialAssumptionLibrary,
          finishingLuxuryText: vr.finishingLuxury,
          finishingMediumText: vr.finishingMedium,
          finishingOrdinaryText: vr.finishingOrdinary,
        });
        return fetchValuationReportV3Html(
          {
            ...meta,
            live: filledLive,
            branding: next,
            valuers: roster,
          },
          "screen",
        );
      })
      .then((next) => {
        if (!cancelled) setScreenHtml(next);
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
  }, [approachSettings, clients, cost, deedSlot, draft, inspector, inventoryLines, listLabels, market, meta, photoSlots, poQuery.isPending, property, recon, record, siteMapSlot, survey, surveySlot]);

  useEffect(
    () => () => {
      if (printUrlRef.current) URL.revokeObjectURL(printUrlRef.current);
    },
    [],
  );

  const print = useCallback(async () => {
    setPrinting(true);
    try {
      const org = await ensureOrganizationSettingsLoaded({ force: true });
      const nextBrand = org?.branding ?? branding;
      const nextValuers = org?.valuers ?? valuers;
      if (org) {
        setBranding(org.branding);
        setValuers(org.valuers ?? []);
      }
      const ev = org?.evaluator ?? {};
      const vr = { ...REPORT_DEFAULTS, ...(org?.valuationReport ?? {}) };
      const html = await fetchValuationReportV3Html(
        {
          ...meta,
          live: buildValuationReportLiveFill({
            draft,
            record,
            property,
            inspector,
            inventoryLines,
            market,
            cost,
            recon,
            clients,
            purposeLabel: listLabels.purpose,
            basisLabel: listLabels.basis,
            premiseLabel: listLabels.premise,
            basisDefinition: listLabels.basisDefinition,
            certifiedName: ev.name || CERTIFIED_VALUER_HTML_DEFAULTS.name,
            certifiedLicense:
              ev.licenseNumber || CERTIFIED_VALUER_HTML_DEFAULTS.licenseNumber,
            certifiedMembershipNumber:
              ev.membershipNumber ||
              CERTIFIED_VALUER_HTML_DEFAULTS.membershipNumber,
            certifiedIssuedAt:
              ev.licenseIssuedAt || CERTIFIED_VALUER_HTML_DEFAULTS.licenseIssuedAt,
            certifiedExpires:
              ev.licenseExpiresHijri ||
              CERTIFIED_VALUER_HTML_DEFAULTS.licenseExpiresHijri,
            certifiedMembershipCategory:
              ev.membershipCategory ||
              CERTIFIED_VALUER_HTML_DEFAULTS.membershipCategory,
            certifiedTitle: ev.title || CERTIFIED_VALUER_HTML_DEFAULTS.title,
            certifiedMembershipExpires:
              ev.membershipExpiresAt ||
              CERTIFIED_VALUER_HTML_DEFAULTS.membershipExpiresAt,
            valuationBranch: vr.valuationBranch,
            reportType: vr.reportType,
            currency: vr.currency,
            effectiveValuationDate: effectiveValuationDate({
              draft,
              inspector,
              settings: approachSettings,
            }),
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
            specialAssumptionLibrary: vr.specialAssumptionLibrary,
            finishingLuxuryText: vr.finishingLuxury,
            finishingMediumText: vr.finishingMedium,
            finishingOrdinaryText: vr.finishingOrdinary,
          }),
          branding: nextBrand,
          valuers: nextValuers,
        },
        "print",
      );
      if (printUrlRef.current) URL.revokeObjectURL(printUrlRef.current);
      const url = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" }),
      );
      printUrlRef.current = url;
      const w = window.open(url, "_blank");
      if (!w) {
        URL.revokeObjectURL(url);
        printUrlRef.current = null;
        return;
      }
      w.addEventListener(
        "load",
        () => {
          w.focus();
          w.print();
        },
        { once: true },
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "تعذّر تجهيز نسخة الطباعة",
      );
    } finally {
      setPrinting(false);
    }
  }, [
    approachSettings,
    branding,
    clients,
    cost,
    deedSlot,
    draft,
    inspector,
    inventoryLines,
    listLabels,
    market,
    meta,
    photoSlots,
    property,
    recon,
    record,
    siteMapSlot,
    survey,
    surveySlot,
    valuers,
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
