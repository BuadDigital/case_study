"use client";

/**
 * Organization settings shell — composition only. `useOrganizationSettingsWorkflow`
 * owns tab routing, the draft and save / test; delegated tabs (company,
 * evaluator, branding, report) render their own full screens, the rest use
 * the generic card with `OrganizationSettingsForms`.
 */

import dynamic from "next/dynamic";
import { Can } from "@platform/app-shared/components/Can";
import {
  Note,
  PageShell,
  Spinner,
  cn,
  opsBtnPrimary,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsTfActions,
  opsTfNote,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "@platform/ui-kit";
import {
  OrganizationCommunicationsForm,
  OrganizationSlaForm,
} from "./OrganizationSettingsForms";
import { formatUpdatedAt, TAB_META, TABS, tabLabel } from "./organization-settings-state";
import { useOrganizationSettingsWorkflow } from "./useOrganizationSettingsWorkflow";

const settingsViewFallback = () => (
  <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
    <div className="flex items-center justify-center gap-2 py-20 text-text-3">
      <Spinner />
      <span className="text-[13px]">جاري التحميل…</span>
    </div>
  </PageShell>
);

const BrandIdentityView = dynamic(
  () => import("./BrandIdentityView").then((m) => m.BrandIdentityView),
  { ssr: false, loading: settingsViewFallback },
);
const OrganizationDataView = dynamic(
  () => import("./OrganizationDataView").then((m) => m.OrganizationDataView),
  { ssr: false, loading: settingsViewFallback },
);
const ValuersRosterView = dynamic(
  () => import("./ValuersRosterView").then((m) => m.ValuersRosterView),
  { ssr: false, loading: settingsViewFallback },
);
const ProfessionalValuationReportView = dynamic(
  () =>
    import("./ProfessionalValuationReportView").then(
      (m) => m.ProfessionalValuationReportView,
    ),
  { ssr: false, loading: settingsViewFallback },
);

function TabIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export function OrganizationSettingsView() {
  const workflow = useOrganizationSettingsWorkflow();
  const { canEdit, tab, setTab, draft, loading, saving, loadError, onSave } = workflow;

  if (tab === "branding") {
    return <BrandIdentityView />;
  }
  if (tab === "company") {
    return <OrganizationDataView />;
  }
  if (tab === "evaluator") {
    return <ValuersRosterView />;
  }
  if (tab === "report") {
    return <ProfessionalValuationReportView />;
  }

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <div className="flex items-center justify-center gap-2 py-20 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري تحميل الإعدادات…</span>
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <Note tone="danger">{loadError}</Note>
      </PageShell>
    );
  }

  const active = TAB_META[tab];

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      {!canEdit ? (
        <p className={cn(opsTfNote, "m-0 mb-3.5")}>
          عرض فقط — حفظ الإعدادات يتطلّب صلاحية ضبط النظام.
        </p>
      ) : null}

      {/* Settings sections — segmented buttons matching ops task pattern */}
      <div
        className={cn(opsTfSegRow, "mb-3.5")}
        role="tablist"
        aria-label="أقسام الإعدادات"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? opsTfSegActive : opsTfSeg}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Section card */}
      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <TabIcon path={active.icon} />
            </span>
            <div>
              <div className={opsLetterTitle}>{tabLabel(tab)}</div>
              <div className={opsLetterSub}>{active.sub}</div>
            </div>
          </div>
          <span className="text-[11.5px] font-semibold text-text-3">
            آخر تحديث: {formatUpdatedAt(draft.updatedAtUtc)}
          </span>
        </div>

        <div className="px-4 pb-[18px] pt-4 sm:px-[18px]">
          {tab === "communications" ? (
            <OrganizationCommunicationsForm workflow={workflow} />
          ) : null}

          {tab === "sla" ? <OrganizationSlaForm workflow={workflow} /> : null}

          <Can capability="manage-system-config">
            <div className={opsTfActions}>
              <button
                type="button"
                className={opsBtnPrimary}
                disabled={saving}
                aria-busy={saving || undefined}
                onClick={() => void onSave()}
              >
                {saving ? <Spinner /> : null}
                <span>{saving ? "جاري الحفظ…" : "✓ حفظ الإعدادات"}</span>
              </button>
            </div>
          </Can>
        </div>
      </section>
    </PageShell>
  );
}
