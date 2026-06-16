"use client";
import { useMemo, useState } from "react";
import { Badge, Input, Label, formControlClassName } from "@platform/design-system";
import {
  PROPERTY_FIELDS_CATALOG,
  PROPERTY_FIELDS_SOURCE_ROLES,
  propertyFieldsCatalogTotalCount,
  type PropertyFieldCatalogGroup,
} from "@platform/app-shared/prototype/property-fields-catalog";

function GroupPanel({
  group,
  expanded,
  onToggle,
}: {
  group: PropertyFieldCatalogGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent p-3.5 text-start"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div>
          <span className="mb-0.5 block text-[10px] text-primary">
            {group.sourceRole}
          </span>
          <span className="block text-xs font-semibold text-text">
            {group.screen}
          </span>
          <span className="mt-0.5 block text-[10px] text-text-3">
            {group.fields.length} حقل
          </span>
        </div>
        <span className="shrink-0 text-xs text-text-3" aria-hidden>
          {expanded ? "▾" : "◂"}
        </span>
      </button>
      {expanded ? (
        <ol className="m-0 grid list-none gap-1.5 border-t border-border px-3.5 py-2.5 ps-8">
          {group.fields.map((field) => (
            <li
              key={`${group.id}-${field.key}`}
              className="flex items-baseline justify-between gap-3 text-xs leading-relaxed text-text-2"
            >
              <span className="flex-1">{field.label}</span>
              <code
                dir="ltr"
                className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-3"
              >
                {field.key}
              </code>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function PropertyFieldsCatalogTab() {
  const total = propertyFieldsCatalogTotalCount();
  const [roleFilter, setRoleFilter] = useState("الكل");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(
    PROPERTY_FIELDS_CATALOG[0]?.id ?? null,
  );

  const normalizedSearch = search.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return PROPERTY_FIELDS_CATALOG.filter((group) => {
      if (roleFilter !== "الكل" && group.sourceRole !== roleFilter) {
        return false;
      }
      if (!normalizedSearch) return true;
      const inScreen = group.screen.toLowerCase().includes(normalizedSearch);
      const inRole = group.sourceRole.toLowerCase().includes(normalizedSearch);
      const inField = group.fields.some(
        (f) =>
          f.label.toLowerCase().includes(normalizedSearch) ||
          f.key.toLowerCase().includes(normalizedSearch),
      );
      return inScreen || inRole || inField;
    });
  }, [roleFilter, normalizedSearch]);

  const visibleFieldCount = visibleGroups.reduce(
    (sum, g) => sum + g.fields.length,
    0,
  );

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-text">حقول النظام</h2>
          <p className="mt-1 text-[11px] text-text-3">
            قائمة بجميع أسماء الحقول في النظام — {total} حقل موثّق عبر{" "}
            {PROPERTY_FIELDS_CATALOG.length} شاشة
          </p>
        </div>
        <Badge tone="info">
          معروض: {visibleFieldCount}/{total}
        </Badge>
      </header>

      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(160px,220px)]">
          <div>
            <Label htmlFor="prop-fields-search">بحث</Label>
            <Input
              id="prop-fields-search"
              placeholder="اسم الحقل أو المفتاح أو الشاشة…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="prop-fields-role">الدور</Label>
            <select
              id="prop-fields-role"
              className={formControlClassName}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="الكل">الكل</option>
              {PROPERTY_FIELDS_SOURCE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 pb-4">
        <div className="grid content-start gap-2">
          {visibleGroups.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-3">
              لا توجد حقول مطابقة للبحث.
            </p>
          ) : (
            visibleGroups.map((group) => (
              <GroupPanel
                key={group.id}
                group={group}
                expanded={expandedId === group.id}
                onToggle={() =>
                  setExpandedId((id) => (id === group.id ? null : group.id))
                }
              />
            ))
          )}
        </div>
      </div>
    </article>
  );
}