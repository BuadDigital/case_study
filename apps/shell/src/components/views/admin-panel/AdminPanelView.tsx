"use client";

/**
 * «لوحة الإدارة» — the system administrator's control panel inside the
 * settings section. The settings tree picks the section through `?tab=`;
 * each section loads its own chunk.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Can } from "@platform/app-shared/components/Can";
import { parseAdminPanelTab } from "@platform/app-shared/app-data/system-settings-nav";
import { EmptyState, PageLoadingHint, PageShell, preloadableLazy } from "@platform/ui-kit";

const sections = {
  overview: preloadableLazy(() =>
    import("./AdminOverviewPanel").then((m) => m.AdminOverviewPanel),
  ),
  accounts: preloadableLazy(() =>
    import("@settings/mfe").then((m) => m.AdminAccountsPanel),
  ),
  "data-fixes": preloadableLazy(() =>
    import("@case-study/mfe/components/admin/AdminDataFixesPanel").then(
      (m) => m.AdminDataFixesPanel,
    ),
  ),
};

export function AdminPanelView() {
  const tab = parseAdminPanelTab(useSearchParams().get("tab"));
  const Section = sections[tab].Component;
  return (
    <PageShell
      variant="canvas"
      className="h-fit min-w-0 max-w-full bg-bg font-sans text-text"
      dir="rtl"
    >
      <Can
        capability="manage-system-config"
        fallback={
          <EmptyState panel line="هذه الصفحة لمسؤول النظام فقط." />
        }
      >
        <Suspense fallback={<PageLoadingHint className="py-20" />}>
          <Section />
        </Suspense>
      </Can>
    </PageShell>
  );
}
