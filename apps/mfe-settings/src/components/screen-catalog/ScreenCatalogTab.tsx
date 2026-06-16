"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Input, cn } from "@platform/design-system";
import {
  SCREEN_CATALOG_KIND_LABELS,
  SCREEN_CATALOG_STATUS_LABELS,
  SYSTEM_SCREEN_CATALOG,
  screenCatalogGroups,
  screenCatalogLocationLabel,
  screenCatalogRoleIds,
  screenCatalogRoleLabel,
  type ScreenCatalogKind,
  type ScreenCatalogStatus,
  type SystemScreenEntry,
} from "@platform/app-shared/prototype/screen-catalog";
import { ScreenCatalogDetailPanel } from "./ScreenCatalogDetailPanel";

type FacetKey = "role" | "group" | "kind" | "status";

const FACET_LABELS: Record<FacetKey, string> = {
  role: "الدور",
  group: "التصنيف",
  kind: "نوع الشاشة",
  status: "الحالة",
};

function emptyFilters(): Record<FacetKey, Set<string>> {
  return {
    role: new Set(),
    group: new Set(),
    kind: new Set(),
    status: new Set(),
  };
}

function statusTone(
  status: ScreenCatalogStatus,
): "success" | "warning" | "default" {
  if (status === "جاهزة") return "success";
  return "warning";
}

export function ScreenCatalogTab() {
  const screens = SYSTEM_SCREEN_CATALOG;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [openFacet, setOpenFacet] = useState<FacetKey | null>(null);
  const [viewMode, setViewMode] = useState<"screens" | "roles">("screens");

  const facetOptions = useMemo(
    () => ({
      role: screenCatalogRoleIds(),
      group: screenCatalogGroups(),
      kind: Object.keys(SCREEN_CATALOG_KIND_LABELS) as ScreenCatalogKind[],
      status: Object.keys(SCREEN_CATALOG_STATUS_LABELS) as ScreenCatalogStatus[],
    }),
    [],
  );

  const visibleScreens = useMemo(() => {
    const q = query.trim().toLowerCase();
    return screens.filter((screen) => {
      if (
        q &&
        !screen.name.toLowerCase().includes(q) &&
        !screen.whereToFind?.toLowerCase().includes(q) &&
        !screen.path.toLowerCase().includes(q) &&
        !(screen.pageId ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (
        filters.role.size &&
        !screen.roles.some((role) => filters.role.has(role))
      ) {
        return false;
      }
      if (filters.group.size && !filters.group.has(screen.group)) return false;
      if (filters.kind.size && !filters.kind.has(screen.kind)) return false;
      if (filters.status.size && !filters.status.has(screen.status))
        return false;
      return true;
    });
  }, [screens, filters, query]);

  const selectedScreen = useMemo(
    () => screens.find((screen) => screen.id === selectedId) ?? null,
    [screens, selectedId],
  );

  const roleSummaries = useMemo(() => {
    return screenCatalogRoleIds()
      .map((roleId) => {
        const roleScreens = screens.filter((screen) =>
          screen.roles.includes(roleId),
        );
        const visible = roleScreens.filter((screen) =>
          visibleScreens.some((item) => item.id === screen.id),
        );
        return {
          roleId,
          label: screenCatalogRoleLabel(roleId),
          total: roleScreens.length,
          visible: visible.length,
          screens: roleScreens,
        };
      })
      .filter((row) => row.visible > 0 || filters.role.has(row.roleId));
  }, [screens, visibleScreens, filters.role]);

  useEffect(() => {
    if (viewMode !== "screens") return;
    if (!selectedId && visibleScreens[0]) setSelectedId(visibleScreens[0].id);
    if (
      selectedId &&
      !visibleScreens.some((screen) => screen.id === selectedId)
    ) {
      setSelectedId(visibleScreens[0]?.id ?? null);
    }
  }, [selectedId, visibleScreens, viewMode]);

  function toggleFilter(facet: FacetKey, value: string): void {
    setFilters((current) => {
      const next = { ...current, [facet]: new Set(current[facet]) };
      if (next[facet].has(value)) next[facet].delete(value);
      else next[facet].add(value);
      return next;
    });
  }

  function clearFilters(): void {
    setFilters(emptyFilters());
  }

  function facetLabel(facet: FacetKey, value: string): string {
    if (facet === "role") return screenCatalogRoleLabel(value as never);
    if (facet === "kind")
      return SCREEN_CATALOG_KIND_LABELS[value as ScreenCatalogKind];
    if (facet === "status")
      return SCREEN_CATALOG_STATUS_LABELS[value as ScreenCatalogStatus];
    return value;
  }

  const activeChips = (Object.keys(filters) as FacetKey[]).flatMap((facet) =>
    [...filters[facet]].map((value) => ({ facet, value })),
  );

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface max-lg:overflow-visible">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-text">دليل الشاشات</h2>
          <p className="mt-1 text-[11px] text-text-3">
            الشاشات الفعلية في النظام — أين تجدها ومن يصل إليها
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">
            {visibleScreens.length}/{screens.length} شاشة
          </Badge>
          <div className="inline-flex rounded-[var(--radius-DEFAULT)] border border-border p-0.5">
            <button
              type="button"
              className={cn(
                "rounded px-2.5 py-1 text-[11px] transition-colors",
                viewMode === "screens"
                  ? "bg-primary text-white"
                  : "text-text-3 hover:text-text",
              )}
              onClick={() => setViewMode("screens")}
            >
              حسب الشاشة
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2.5 py-1 text-[11px] transition-colors",
                viewMode === "roles"
                  ? "bg-primary text-white"
                  : "text-text-3 hover:text-text",
              )}
              onClick={() => setViewMode("roles")}
            >
              حسب الدور
            </button>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الشاشة أو مكانها في النظام…"
            />
          </div>
          {(Object.keys(FACET_LABELS) as FacetKey[]).map((facet) => (
            <div key={facet} className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-DEFAULT)] border border-border bg-surface px-2.5 py-2 text-xs text-text"
                onClick={() =>
                  setOpenFacet((current) => (current === facet ? null : facet))
                }
              >
                {FACET_LABELS[facet]}
                {filters[facet].size ? (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">
                    {filters[facet].size}
                  </span>
                ) : null}
                ▾
              </button>
              {openFacet === facet ? (
                <div className="absolute end-0 top-[calc(100%+4px)] z-20 max-h-64 min-w-[190px] overflow-auto rounded-[var(--radius-DEFAULT)] border border-border bg-surface p-1.5 shadow-lg">
                  {facetOptions[facet].map((value) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={filters[facet].has(value)}
                        onChange={() => toggleFilter(facet, value)}
                      />
                      {facetLabel(facet, value)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {activeChips.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={`${chip.facet}-${chip.value}`}
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary"
                onClick={() => toggleFilter(chip.facet, chip.value)}
              >
                {FACET_LABELS[chip.facet]}: {facetLabel(chip.facet, chip.value)}
                <span className="font-bold">✕</span>
              </button>
            ))}
            <button
              type="button"
              className="text-[11px] text-text-3 underline"
              onClick={clearFilters}
            >
              مسح الكل
            </button>
          </div>
        ) : null}
      </div>

      {viewMode === "screens" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:min-h-0 max-lg:flex-none max-lg:overflow-visible lg:flex-row">
          <div className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden border-border max-lg:max-h-none max-lg:overflow-visible lg:max-w-[62%] lg:border-e">
            <div className="grid shrink-0 grid-cols-[1.1fr_1.1fr_.75fr_.55fr] gap-2 border-b border-border bg-surface-2 px-3 py-2 text-[10px] text-text-3">
              <span>اسم الشاشة</span>
              <span>أين تُجد في النظام</span>
              <span>النوع</span>
              <span>الحالة</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-lg:max-h-none max-lg:overflow-visible lg:min-h-0">
              {visibleScreens.length === 0 ? (
                <p className="py-10 text-center text-xs text-text-3">
                  لا توجد شاشات مطابقة
                </p>
              ) : (
                visibleScreens.map((screen) => (
                  <ScreenListRow
                    key={screen.id}
                    screen={screen}
                    selected={selectedId === screen.id}
                    onSelect={() => setSelectedId(screen.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface max-lg:overflow-visible">
            {selectedScreen ? (
              <ScreenCatalogDetailPanel screen={selectedScreen} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-xs text-text-3">
                اختر شاشة من القائمة لعرض تفاصيلها
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {roleSummaries.map((row) => (
              <section
                key={row.roleId}
                className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface"
              >
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  <h3 className="text-xs font-semibold text-text">
                    {row.label}
                  </h3>
                  <Badge tone="info">{row.visible} شاشة</Badge>
                </header>
                <ul className="divide-y divide-border">
                  {row.screens
                    .filter((screen) =>
                      visibleScreens.some((item) => item.id === screen.id),
                    )
                    .map((screen) => (
                      <li key={screen.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-start text-xs hover:bg-surface-2"
                          onClick={() => {
                            setViewMode("screens");
                            setSelectedId(screen.id);
                          }}
                        >
                          <span className="font-medium text-text">
                            {screen.name}
                          </span>
                          <span className="text-[11px] text-text-3">
                            {screenCatalogLocationLabel(screen)}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function ScreenListRow({
  screen,
  selected,
  onSelect,
}: {
  screen: SystemScreenEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[1.1fr_1.1fr_.75fr_.55fr] gap-2 border-b border-border px-3 py-2 text-start text-xs transition-colors hover:bg-surface-2",
        selected && "bg-primary/8",
      )}
      onClick={onSelect}
    >
      <span className="font-medium text-text">{screen.name}</span>
      <span className="line-clamp-2 text-[11px] text-text-3">
        {screenCatalogLocationLabel(screen)}
      </span>
      <span className="text-text-3">
        {SCREEN_CATALOG_KIND_LABELS[screen.kind]}
      </span>
      <span>
        <Badge tone={statusTone(screen.status)}>{screen.status}</Badge>
      </span>
    </button>
  );
}
