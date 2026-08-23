"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner } from "@platform/ui-kit";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import {
  CERTIFIED_VALUER_HTML_DEFAULTS,
  getApiBase,
  getValuationLists,
  listClients,
  VALUATION_REPORT_HTML_DEFAULTS as REPORT_DEFAULTS,
  type ClientDto,
  type OrganizationBrandingSettings,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { fetchValuationReportV3Html } from "../../lib/evaluator/valuation-report-v3-preview";
import {
  assignmentValuationFromPo,
  buildValuationReportLiveFill,
} from "../../lib/evaluator/valuation-report-live-fill";

export function EvaluatorValuationReportOutputTab({
  draft,
  property,
  inspectionTaskId,
}: {
  draft: EvaluatorSubmission;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
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
    if (!inspectionTaskId) {
      setInspector(null);
      return;
    }
    let cancelled = false;
    void fetchInspectorWorkspace(inspectionTaskId).then((ws) => {
      if (!cancelled) setInspector(ws);
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId]);

  useEffect(() => {
    const session = getAuthSession();
    if (!session?.token) return;
    let cancelled = false;
    void Promise.all([
      getValuationLists({ token: session.token, baseUrl: getApiBase() }),
      listClients({ token: session.token, baseUrl: getApiBase() }),
    ]).then(([listsRes, clientsRes]) => {
      if (cancelled) return;
      if (clientsRes.ok) setClients(clientsRes.data);
      if (!listsRes.ok) return;
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
    });
    return () => {
      cancelled = true;
    };
  }, [poKeys.premiseKey, poKeys.purposeKey, poKeys.valueBasisKey]);

  const live = useMemo(() => {
    const htmlEv = CERTIFIED_VALUER_HTML_DEFAULTS;
    return buildValuationReportLiveFill({
      draft,
      record,
      property,
      inspector,
      clients,
      purposeLabel: listLabels.purpose,
      basisLabel: listLabels.basis,
      premiseLabel: listLabels.premise,
      basisDefinition: listLabels.basisDefinition,
      certifiedName: htmlEv.name,
      certifiedLicense: htmlEv.licenseNumber,
      certifiedIssuedAt: htmlEv.licenseIssuedAt,
      certifiedExpires: htmlEv.licenseExpiresHijri,
      reportType: REPORT_DEFAULTS.reportType,
      currency: REPORT_DEFAULTS.currency,
    });
  }, [clients, draft, inspector, listLabels, property, record]);

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
        }
        const filledLive = buildValuationReportLiveFill({
          draft,
          record,
          property,
          inspector,
          clients,
          purposeLabel: listLabels.purpose,
          basisLabel: listLabels.basis,
          premiseLabel: listLabels.premise,
          basisDefinition: listLabels.basisDefinition,
          certifiedName: ev.name || CERTIFIED_VALUER_HTML_DEFAULTS.name,
          certifiedLicense:
            ev.licenseNumber || CERTIFIED_VALUER_HTML_DEFAULTS.licenseNumber,
          certifiedIssuedAt:
            ev.licenseIssuedAt || CERTIFIED_VALUER_HTML_DEFAULTS.licenseIssuedAt,
          certifiedExpires:
            ev.licenseExpiresHijri ||
            CERTIFIED_VALUER_HTML_DEFAULTS.licenseExpiresHijri,
          valuationBranch: vr.valuationBranch,
          reportType: vr.reportType,
          currency: vr.currency,
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
  }, [clients, draft, inspector, listLabels, meta, poQuery.isPending, property, record]);

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
            clients,
            purposeLabel: listLabels.purpose,
            basisLabel: listLabels.basis,
            premiseLabel: listLabels.premise,
            basisDefinition: listLabels.basisDefinition,
            certifiedName: ev.name || CERTIFIED_VALUER_HTML_DEFAULTS.name,
            certifiedLicense:
              ev.licenseNumber || CERTIFIED_VALUER_HTML_DEFAULTS.licenseNumber,
            certifiedIssuedAt:
              ev.licenseIssuedAt || CERTIFIED_VALUER_HTML_DEFAULTS.licenseIssuedAt,
            certifiedExpires:
              ev.licenseExpiresHijri ||
              CERTIFIED_VALUER_HTML_DEFAULTS.licenseExpiresHijri,
            valuationBranch: vr.valuationBranch,
            reportType: vr.reportType,
            currency: vr.currency,
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
    branding,
    clients,
    draft,
    inspector,
    listLabels,
    meta,
    property,
    record,
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
