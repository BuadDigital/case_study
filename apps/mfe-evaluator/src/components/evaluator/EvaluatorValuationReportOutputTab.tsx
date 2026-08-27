"use client";

import { useCallback, useEffect, useState } from "react";
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
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import { loadInfathDeposit } from "@case-study/mfe/lib/prototype/infath-deposit-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import { isLandInspectionContext } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
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
  /** من توزيع المعاملات — يُطبع عموداً رابعاً في المشاركين. */
  assignedAppraiserName?: string | null;
}) {
  const [screenHtml, setScreenHtml] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [inspector, setInspector] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [inventoryLines, setInventoryLines] = useState<
    BuildingInventoryLineDto[]
  >([]);
  const [market, setMarket] =
    useState<ValuationComparableSelectionListDto | null>(null);
  const [landMarket, setLandMarket] =
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
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
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
    // صور المعاينة مرتبطة بمعرّف المهمة — تُجمع من مسودة المعاين وتُمرَّر للمحمّل.
    const attachmentsP = inspectorP.then((ws) =>
      propertyId
        ? loadValuationReportPrintAttachments(config, propertyId, true, {
            inspectorPhotoIds: collectInspectorPhotoAttachmentIds(ws),
          })
        : {
            photos: [] as ValuationReportSlotAttachment[],
            survey: null as ValuationReportSlotAttachment | null,
            deed: null as ValuationReportSlotAttachment | null,
            siteMap: null as ValuationReportSlotAttachment | null,
          },
    );

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
        setLandMarket(approaches.landMarket);
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

  useEffect(() => {
    if (draft.poNumber && poQuery.isPending) return;
    let cancelled = false;
    setError(null);
    // Use the shared cache — do not force-refetch (that caused a request storm).
    void ensureOrganizationSettingsLoaded()
      .then((loaded) => {
        if (cancelled) return null;
        if (loaded) setOrg(loaded);
        const ev = loaded?.evaluator ?? {};
        const vr = { ...REPORT_DEFAULTS, ...(loaded?.valuationReport ?? {}) };
        return fetchValuationReportV3Html(
          {
            reportNo: draft.reportNo,
            reportDate: draft.appraisalDate || draft.reportIssueDate,
            // رمز الإيداع: المسودة أولاً ثم ما حفظته شاشة إيداع نفاذ لهذا العقار.
            depositCode:
              draft.depositCode ||
              loadInfathDeposit(property?.id ?? "").depositCode,
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
              // بلا احتياطي عيّنة — إعدادات المنشأة أو «—» في التقرير.
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
  }, [
    approachSettings,
    assignedAppraiserName,
    clients,
    cost,
    deedSlot,
    draft,
    inspector,
    inventoryLines,
    listLabels,
    market,
    landMarket,
    photoSlots,
    poQuery.isPending,
    property,
    recon,
    record,
    siteMapSlot,
    survey,
    surveySlot,
  ]);

  const print = useCallback(async () => {
    setPrinting(true);
    try {
      const loaded = await ensureOrganizationSettingsLoaded({ force: true });
      if (loaded) setOrg(loaded);
      const ev = loaded?.evaluator ?? {};
      const vr = { ...REPORT_DEFAULTS, ...(loaded?.valuationReport ?? {}) };
      const html = await fetchValuationReportV3Html(
        {
          reportNo: draft.reportNo,
          reportDate: draft.appraisalDate || draft.reportIssueDate,
          depositCode:
            draft.depositCode ||
            loadInfathDeposit(property?.id ?? "").depositCode,
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
  }, [
    approachSettings,
    assignedAppraiserName,
    clients,
    cost,
    deedSlot,
    draft,
    inspector,
    inventoryLines,
    listLabels,
    market,
    org,
    photoSlots,
    property,
    recon,
    record,
    siteMapSlot,
    survey,
    surveySlot,
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
