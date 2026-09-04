"use client";

/**
 * Professional valuation report settings — the printed report's standing texts,
 * edited section by section. The two printed pages are sibling components; pure
 * text helpers live in `professional-valuation-report-state.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BRAND_IDENTITY_DEFAULTS,
  CERTIFIED_VALUER_HTML_DEFAULTS,
  VALUATION_REPORT_HTML_DEFAULTS as D,
  getOrganizationSettings,
  getValuationLists,
  saveOrganizationSettings,
  type OrganizationSettingsDto,
  type OrganizationValuationReportSettings,
  type ValuationListsDto,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { Button, Note, PageShell, Spinner, useToast } from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import { refreshOrgCache } from "../lib/org-settings-ui";
import {
  enabledList,
  filled,
} from "./professional-valuation-report-state";
import { ProfessionalReportIdentityPage } from "./ProfessionalReportIdentityPage";
import { ProfessionalReportTextsPage } from "./ProfessionalReportTextsPage";

export function ProfessionalValuationReportView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [lists, setLists] = useState<ValuationListsDto | null>(null);
  const [draft, setDraft] = useState<OrganizationValuationReportSettings>(D);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const [orgRes, listRes] = await Promise.all([
      getOrganizationSettings(config),
      getValuationLists(config),
    ]);
    setLoading(false);
    if (!orgRes.ok) {
      setError("تعذّر تحميل تقرير التقييم المهني");
      return;
    }
    setError(null);
    setOrg(orgRes.data);
    const vr = orgRes.data.valuationReport;
    setDraft({
      ...D,
      ...vr,
      reportType: filled(vr.reportType, D.reportType),
      currency: filled(vr.currency, D.currency),
      valuationBranch: filled(vr.valuationBranch, D.valuationBranch),
      keyInputsText: filled(vr.keyInputsText, D.keyInputsText),
      professionalStandards: filled(vr.professionalStandards, D.professionalStandards),
      independence: filled(vr.independence, D.independence),
      researchScopeText: filled(vr.researchScopeText, D.researchScopeText),
      terms: filled(vr.terms, D.terms),
      restrictions: filled(vr.restrictions, D.restrictions),
      finishingLuxury: filled(vr.finishingLuxury, D.finishingLuxury),
      finishingMedium: filled(vr.finishingMedium, D.finishingMedium),
      finishingOrdinary: filled(vr.finishingOrdinary, D.finishingOrdinary),
      specialAssumptionLibrary:
        vr.specialAssumptionLibrary.filter((x) => x.trim()).length > 0
          ? vr.specialAssumptionLibrary
          : D.specialAssumptionLibrary,
    });
    if (listRes.ok) setLists(listRes.data);
    setDirty(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = (next: Partial<OrganizationValuationReportSettings>) => {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
  };

  const toggle = (n: string) => setOpen((s) => ({ ...s, [n]: !s[n] }));
  const isOpen = (n: string) => Boolean(open[n]);

  const ivsDate = filled(lists?.ivsEffectiveDate, "31 يناير 2025");
  const ev = org?.evaluator ?? {};
  const htmlEv = CERTIFIED_VALUER_HTML_DEFAULTS;
  const certName = filled(ev.name, htmlEv.name ?? "");
  const stamp = filled(org?.branding.stampUrl, BRAND_IDENTITY_DEFAULTS.stampUrl);
  const parts = useMemo(
    () => (org?.valuers ?? []).filter((v) => v.role !== "certified" && v.isActive),
    [org],
  );
  const glossary = enabledList(lists?.lists, "glossary");
  const ivs = enabledList(lists?.lists, "ivsStandards");

  async function persist() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveOrganizationSettings(config, { valuationReport: draft });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ تقرير التقييم المهني", "error");
      return;
    }
    setOrg(res.data);
    setDirty(false);
    await refreshOrgCache();
    showToast("تم الحفظ وقُيّد في سجل التدقيق.", "success");
  }

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <div className="flex items-center justify-center gap-2 py-20 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري التحميل…</span>
        </div>
      </PageShell>
    );
  }

  const listsHref = "/attachment-print-dictionary";
  const valuersHref = "/organization-settings?tab=evaluator";
  const orgHref = "/organization-settings?tab=company";
  const brandHref = "/organization-settings?tab=branding";

  return (
    <PageShell variant="canvas" className="gap-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-6" dir="rtl">
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}

      {/* Decision 23: one version for the whole text pack — any edit, even one paragraph, issues a new pack;
          in-progress adopts the latest; issued is frozen to texts at issue time. */}
      <Note tone="info" className="mb-3 max-w-[560px]">
        حزمة النصوص المعيارية/القانونية — <strong>نسخة {org?.valuationReport.textPackageVersion ?? 1}</strong>
        {" · "}أي تعديل في النصوص يصدر حزمة جديدة كاملة، والتقارير المُصدَرة تبقى مجمّدة على
        نصوصها (قرار 23).
      </Note>

      <div className="rpt-ref">
        <ProfessionalReportIdentityPage
          draft={draft}
          patch={patch}
          canEdit={canEdit}
          isOpen={isOpen}
          toggle={toggle}
          org={org}
          ev={ev}
          htmlEv={htmlEv}
          certName={certName}
          stamp={stamp}
          parts={parts}
          ivsDate={ivsDate}
          listsHref={listsHref}
          valuersHref={valuersHref}
          orgHref={orgHref}
          brandHref={brandHref}
        />

        <ProfessionalReportTextsPage
          draft={draft}
          patch={patch}
          canEdit={canEdit}
          isOpen={isOpen}
          toggle={toggle}
          lists={lists}
          glossary={glossary}
          ivs={ivs}
          listsHref={listsHref}
        />
      </div>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[11.5px] text-amber-text">
              <span className="size-1.5 rounded-full bg-warning" />
              تعديل غير محفوظ
            </span>
          ) : null}
          <Button variant="primary" loading={saving} onClick={() => void persist()}>
            حفظ
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}
