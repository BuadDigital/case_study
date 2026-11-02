"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reviewPropertyUsage, type ValuationListItemDto } from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { canManageWorkOrders } from "@platform/app-shared/app-data/runtime-access";
import {
  listedPropertyUsage,
  looksLikeUsageName,
  similarPropertyUsages,
} from "@platform/app-shared/app-data/property-usage-names";
import {
  useEnabledValuationListRows,
  syncValuationListsCache,
} from "@platform/app-shared/query/valuation-lists-query";
import { Button, cn, Input, Select, useToast } from "@platform/ui-kit";
import {
  PROPERTY_USAGE_OPTIONS,
  PROPERTY_USAGES_LIST_ID,
  propertyUsageValue,
} from "../../lib/app-data/inspector-workspace-data";

const ADD_NAME = "__add_usage__";

/** A name written on this inspection that the list does not hold as approved yet. */
function pendingUsageRow(
  rows: ValuationListItemDto[] | undefined,
  value: string,
): ValuationListItemDto | undefined {
  return rows?.find((row) => row.status === "pending" && row.name.trim() === value);
}

/**
 * The note under a usage name awaiting review, with the specialist's approve and correct actions.
 *
 * How it works: anyone sees that the name is new. Case staff may approve it here, or correct it, which
 * also changes it on this property through `onChange`. They do not need the settings pages.
 *
 * Edge cases: on a locked inspection `onChange` is absent, so the name can be approved but not corrected.
 * A name still only on the inspector's phone has no row yet: it is reviewed once the inspection arrives.
 */
export function InspectorPropertyUsageNote({
  value,
  onChange,
}: {
  value: string;
  onChange?: (next: string) => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const rows = useEnabledValuationListRows(PROPERTY_USAGES_LIST_ID);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = propertyUsageValue(value);
  const row = pendingUsageRow(rows, clean);
  if (!clean || !row) return null;

  async function review(action: "approve" | "rename") {
    const config = apiConfig();
    if (!config || !row) return;
    setBusy(true);
    const nameAr = action === "rename" ? name.trim() : undefined;
    const result = await reviewPropertyUsage(config, row.key, { action, nameAr });
    setBusy(false);
    if (!result.ok) {
      showToast(result.message ?? "تعذّر اعتماد الاسم", "error");
      return;
    }
    syncValuationListsCache(queryClient, result.data);
    if (nameAr) onChange?.(nameAr);
    setRenaming(false);
    showToast("تم اعتماد الاسم", "success");
  }

  const canReview = canManageWorkOrders();
  return (
    <div className="mt-1 text-center text-[11px] text-text-3">
      <span>اسم جديد بانتظار الاعتماد</span>
      {canReview && !renaming ? (
        <span className="ms-2 inline-flex gap-1.5">
          <Button type="button" size="sm" disabled={busy} onClick={() => void review("approve")}>
            اعتماد
          </Button>
          {onChange ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                setName(clean);
                setRenaming(true);
              }}
            >
              تصحيح
            </Button>
          ) : null}
        </span>
      ) : null}
      {canReview && renaming ? (
        <span className="mt-1.5 flex items-center gap-1.5">
          <Input
            value={name}
            aria-label="تصحيح اسم الاستخدام"
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={busy || !looksLikeUsageName(name)}
            onClick={() => void review("rename")}
          >
            تصحيح واعتماد
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => setRenaming(false)}>
            إلغاء
          </Button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * «استخدام العقار»: the settings list, plus a name the list lacks, as with an unregistered city.
 *
 * How it works: the list is the settings one, pending names included, or the built-in copy until it
 * loads and on a phone offline. Choosing «غير موجود في القائمة» opens a text box. A name that is on the
 * list under another spelling takes the listed one; a look-alike asks «هل تقصد؟» first; a new name is
 * set on the draft and joins the list as pending when the inspection reaches the server.
 *
 * Edge cases: an old value holding a classification shows as empty. A saved name that has left the list
 * stays selectable, so an open inspection does not lose it.
 */
export function InspectorPropertyUsageField({
  id,
  value,
  invalid,
  controlClassName,
  onChange,
}: {
  id?: string;
  value: string;
  invalid?: boolean;
  controlClassName?: string;
  onChange: (next: string) => void;
}) {
  const rows = useEnabledValuationListRows(PROPERTY_USAGES_LIST_ID);
  const names = rows?.map((row) => row.name.trim()) ?? PROPERTY_USAGE_OPTIONS;
  const clean = propertyUsageValue(value);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [similar, setSimilar] = useState<string[]>([]);
  const [error, setError] = useState("");

  function closeTyping() {
    setTyping(false);
    setTyped("");
    setSimilar([]);
    setError("");
  }

  function choose(next: string) {
    onChange(next);
    closeTyping();
  }

  function submitTyped() {
    const name = typed.trim();
    const listed = listedPropertyUsage(names, name);
    if (listed) {
      choose(listed);
      return;
    }
    if (!looksLikeUsageName(name)) {
      setError("اكتب اسم الاستخدام بالعربية");
      return;
    }
    const alike = similarPropertyUsages(names, name);
    if (alike.length > 0) {
      setSimilar(alike);
      return;
    }
    choose(name);
  }

  if (typing) {
    return (
      <div className="grid gap-1.5">
        <Input
          id={id}
          value={typed}
          autoFocus
          aria-label="استخدام غير موجود في القائمة"
          placeholder="اكتب الاستخدام كما وجدته"
          aria-invalid={Boolean(error) || undefined}
          className={controlClassName}
          onChange={(e) => {
            setTyped(e.target.value);
            setSimilar([]);
            setError("");
          }}
        />
        {error ? (
          <p className="m-0 text-[11px] font-semibold text-danger-text" role="alert">
            {error}
          </p>
        ) : null}
        {similar.length > 0 ? (
          <div className="grid gap-1 text-[11.5px] text-text-2">
            <span>هل تقصد:</span>
            <span className="flex flex-wrap gap-1.5">
              {similar.map((name) => (
                <Button key={name} type="button" size="sm" onClick={() => choose(name)}>
                  {name}
                </Button>
              ))}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={!typed.trim()}
            onClick={() => (similar.length > 0 ? choose(typed.trim()) : submitTyped())}
          >
            {similar.length > 0 ? `متابعة باسم «${typed.trim()}»` : "إضافة"}
          </Button>
          <Button type="button" size="sm" onClick={closeTyping}>
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Select
        id={id}
        value={clean}
        aria-invalid={invalid || undefined}
        className={cn(controlClassName)}
        onChange={(e) => {
          if (e.target.value === ADD_NAME) setTyping(true);
          else onChange(e.target.value);
        }}
      >
        <option value="">— اختر —</option>
        {clean && !names.includes(clean) ? <option value={clean}>{clean}</option> : null}
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={ADD_NAME}>غير موجود في القائمة…</option>
      </Select>
      <InspectorPropertyUsageNote value={clean} onChange={onChange} />
    </>
  );
}
