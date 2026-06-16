"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Input, cn } from "@platform/design-system";
import {
  FIELD_TYPE_LABELS,
  FIELD_DICTIONARY_LAYER_LABELS,
  fieldDictionaryLayer,
  fieldDictionaryRoleLabel,
  fieldDictionaryScreenName,
  fieldReliabilityMode,
  fieldRoles,
  fieldScreens,
  type FieldDictionaryLayer,
  loadFieldDictionaryState,
  resetFieldDictionaryState,
  saveFieldDictionaryState,
  type FieldDictionaryField,
  type FieldDictionaryState,
  type FieldReliabilityMode,
} from "@platform/app-shared/prototype/field-dictionary";
import { FieldDictionaryAddModal } from "./FieldDictionaryAddModal";
import { FieldDictionaryDetailPanel } from "./FieldDictionaryDetailPanel";

type FacetKey = "type" | "tag" | "role" | "screen" | "mode" | "layer";

const FACET_LABELS: Record<FacetKey, string> = {
  type: "النوع",
  tag: "الوسم",
  role: "الدور",
  screen: "الشاشة",
  mode: "وضع الموثوقية",
  layer: "المصدر",
};

function emptyFilters(): Record<FacetKey, Set<string>> {
  return {
    type: new Set(),
    tag: new Set(),
    role: new Set(),
    screen: new Set(),
    mode: new Set(),
    layer: new Set(),
  };
}

export function FieldDictionaryTab() {
  const [state, setState] = useState<FieldDictionaryState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [openFacet, setOpenFacet] = useState<FacetKey | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    setState(loadFieldDictionaryState());
  }, []);

  const persist = useCallback((next: FieldDictionaryState) => {
    setState(next);
    saveFieldDictionaryState(next);
  }, []);

  const fields = state?.fields ?? [];
  const tags = state?.tags ?? [];

  const facetOptions = useMemo(() => {
    const typeSet = new Set<string>();
    const tagSet = new Set<string>(tags);
    const roleSet = new Set<string>();
    const screenSet = new Set<string>();
    const modeSet = new Set<FieldReliabilityMode>();

    fields.forEach((field) => {
      typeSet.add(field.type);
      field.tags.forEach((tag) => tagSet.add(tag));
      fieldRoles(field).forEach((role) => roleSet.add(role));
      fieldScreens(field).forEach((screen) => screenSet.add(screen));
      modeSet.add(fieldReliabilityMode(field));
    });

    return {
      type: [...typeSet],
      tag: [...tagSet],
      role: [...roleSet],
      screen: [...screenSet],
      mode: [...modeSet],
      layer: ["frontend", "backend"],
    };
  }, [fields, tags]);

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fields.filter((field) => {
      if (q && !field.name.toLowerCase().includes(q) && !field.ref.toLowerCase().includes(q))
        return false;
      if (filters.type.size && !filters.type.has(field.type)) return false;
      if (filters.tag.size && !field.tags.some((tag) => filters.tag.has(tag)))
        return false;
      if (
        filters.role.size &&
        !fieldRoles(field).some((role) => filters.role.has(role))
      )
        return false;
      if (
        filters.screen.size &&
        !fieldScreens(field).some((screen) => filters.screen.has(screen))
      )
        return false;
      if (
        filters.mode.size &&
        !filters.mode.has(fieldReliabilityMode(field))
      )
        return false;
      if (
        filters.layer.size &&
        !filters.layer.has(fieldDictionaryLayer(field))
      )
        return false;
      return true;
    });
  }, [fields, filters, query]);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedId) ?? null,
    [fields, selectedId],
  );

  useEffect(() => {
    if (!selectedId && visibleFields[0]) setSelectedId(visibleFields[0].id);
    if (selectedId && !visibleFields.some((field) => field.id === selectedId)) {
      setSelectedId(visibleFields[0]?.id ?? null);
    }
  }, [selectedId, visibleFields]);

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
    if (facet === "type") return FIELD_TYPE_LABELS[value as never] ?? value;
    if (facet === "role") return fieldDictionaryRoleLabel(value as never);
    if (facet === "screen") return fieldDictionaryScreenName(value);
    if (facet === "layer")
      return FIELD_DICTIONARY_LAYER_LABELS[value as FieldDictionaryLayer];
    return value;
  }

  function handleAddField(field: FieldDictionaryField): void {
    if (!state) return;
    persist({ ...state, fields: [field, ...state.fields] });
    setSelectedId(field.id);
    setAddOpen(false);
  }

  function handleDeleteField(field: FieldDictionaryField): void {
    if (!state) return;
    if (!window.confirm(`حذف الحقل «${field.name}» نهائياً؟`)) return;
    persist({
      ...state,
      fields: state.fields.filter((item) => item.id !== field.id),
    });
    setSelectedId(null);
  }

  function handleUpdateField(field: FieldDictionaryField): void {
    if (!state) return;
    persist({
      ...state,
      fields: state.fields.map((item) =>
        item.id === field.id ? field : item,
      ),
    });
  }

  function handleAddTag(tag: string): void {
    if (!state || state.tags.includes(tag)) return;
    persist({ ...state, tags: [...state.tags, tag] });
  }

  function handleReset(): void {
    if (
      !window.confirm(
        "إعادة بناء القاموس من حقول النظام الحالية؟ ستُفقد التعديلات المحلية.",
      )
    )
      return;
    const next = resetFieldDictionaryState();
    setState(next);
    setSelectedId(next.fields[0]?.id ?? null);
    clearFilters();
  }

  if (!state) {
    return (
      <article className="flex min-h-0 flex-1 items-center justify-center bg-surface text-xs text-text-3">
        جاري تحميل القاموس…
      </article>
    );
  }

  const activeChips = (Object.keys(filters) as FacetKey[]).flatMap((facet) =>
    [...filters[facet]].map((value) => ({ facet, value })),
  );

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface max-lg:overflow-visible">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-text">قاموس الحقول المركزي</h2>
          <p className="mt-1 text-[11px] text-text-3">
            كل حقل يُعرَّف مرة واحدة — الإسناد والموثوقية حسب دور النظام والشاشة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">
            {visibleFields.length}/{fields.length} حقلاً
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            إعادة الجلب
          </Button>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            ＋ حقل جديد
          </Button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الحقل أو رقمه المرجعي…"
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
                      {facet === "role"
                        ? fieldDictionaryRoleLabel(value as never)
                        : facet === "type"
                          ? FIELD_TYPE_LABELS[value as never]
                          : facet === "screen"
                            ? fieldDictionaryScreenName(value)
                            : facet === "layer"
                              ? FIELD_DICTIONARY_LAYER_LABELS[
                                  value as FieldDictionaryLayer
                                ]
                            : value}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:min-h-0 max-lg:flex-none max-lg:overflow-visible lg:flex-row">
        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden border-border max-lg:max-h-none max-lg:overflow-visible lg:max-w-[62%] lg:border-e">
          <div className="grid shrink-0 grid-cols-[.55fr_1.4fr_.8fr_1fr] gap-2 border-b border-border bg-surface-2 px-3 py-2 text-[10px] text-text-3">
            <span>#</span>
            <span>الحقل</span>
            <span>النوع</span>
            <span>الوضع / الوسوم</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-lg:max-h-none max-lg:overflow-visible lg:min-h-0">
            {visibleFields.length === 0 ? (
              <p className="py-10 text-center text-xs text-text-3">
                لا توجد حقول مطابقة
              </p>
            ) : (
              visibleFields.map((field) => {
                const mode = fieldReliabilityMode(field);
                return (
                  <button
                    key={field.id}
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[.55fr_1.4fr_.8fr_1fr] gap-2 border-b border-border px-3 py-2 text-start text-xs transition-colors hover:bg-surface-2",
                      selectedId === field.id && "bg-primary/8",
                    )}
                    onClick={() => setSelectedId(field.id)}
                  >
                    <span className="font-mono text-[10px] text-text-3">
                      {field.ref}
                    </span>
                    <span className="font-medium text-text">{field.name}</span>
                    <span className="text-text-3">
                      {FIELD_TYPE_LABELS[field.type]}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <Badge tone={mode === "متعدد" ? "warning" : "success"}>
                        {mode}
                      </Badge>
                      {field.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-3"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface max-lg:overflow-visible">
          {selectedField ? (
            <FieldDictionaryDetailPanel
              field={selectedField}
              onUpdate={handleUpdateField}
              onDelete={() => handleDeleteField(selectedField)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-xs text-text-3">
              اختر حقلاً من القائمة لعرض تعريفه
            </div>
          )}
        </div>
      </div>

      {addOpen ? (
        <FieldDictionaryAddModal
          tags={tags}
          listFields={fields}
          onAddTag={handleAddTag}
          onSave={handleAddField}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {openFacet ? (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label="إغلاق الفلاتر"
          onClick={() => setOpenFacet(null)}
        />
      ) : null}
    </article>
  );
}
