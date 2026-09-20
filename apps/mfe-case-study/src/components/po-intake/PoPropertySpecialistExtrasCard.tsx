"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getWorkOrder,
  updateSpecialistReportExtras,
  type PartyFieldProvenanceEntry,
} from "@platform/api-client";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT,
  normalizeSpecialistFinishingLevel,
  specialistFinishingLevelLabel,
  type SpecialistFinishingLevel,
} from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import { hydrateSpecialistReportExtrasFromApi } from "@platform/app-shared/storage/specialist-report-extras-sync";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  InlineLoadingSkeleton,
  Note,
  useToast,
} from "@platform/ui-kit";
import { partyProvenanceLines } from "../../lib/app-data/property-party-fields";
import { resolveApiError, workOrdersApiConfig } from "../../lib/work-orders-api-config";

const FINISHING_KEY = "finishing";
const LEVELS: readonly SpecialistFinishingLevel[] = [
  "luxury",
  "medium",
  "ordinary",
  "none",
];

type ExtrasState = {
  bag: Record<string, unknown>;
  provenance: Record<string, PartyFieldProvenanceEntry>;
};

function parseObject(json: string | null | undefined): Record<string, unknown> {
  if (!json?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toState(dto: {
  specialistReportExtrasJson?: string | null;
  specialistReportExtrasProvenanceJson?: string | null;
}): ExtrasState {
  return {
    bag: parseObject(dto.specialistReportExtrasJson),
    provenance: parseObject(
      dto.specialistReportExtrasProvenanceJson,
    ) as Record<string, PartyFieldProvenanceEntry>,
  };
}

/**
 * «تعديل العقار» — the case specialist's report extras (building finishing level), with who
 * chose it and who last changed it. Stored with the property, not with a party package.
 */
export function PoPropertySpecialistExtrasCard({
  poNumber,
  propertyId,
  canEdit,
}: {
  poNumber: string;
  propertyId: string;
  canEdit: boolean;
}) {
  const { showToast } = useToast();
  const [state, setState] = useState<ExtrasState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SpecialistFinishingLevel | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const config = workOrdersApiConfig();
    if (!config) {
      setLoading(false);
      return;
    }
    void getWorkOrder(config, poNumber).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const property = res.data.properties.find((p) => p.id === propertyId);
        setState(property ? toState(property) : { bag: {}, provenance: {} });
      } else {
        setLoadError(resolveApiError(res.kind, undefined, "تعذّر تحميل إضافات التقرير"));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [poNumber, propertyId]);

  const saved = normalizeSpecialistFinishingLevel(
    typeof state?.bag[FINISHING_KEY] === "string"
      ? (state.bag[FINISHING_KEY] as string)
      : "",
  );
  const level = draft ?? saved;
  const dirty = draft !== null && draft !== saved;
  const { written, edited } = partyProvenanceLines(state?.provenance[FINISHING_KEY]);

  const save = useCallback(async () => {
    const config = workOrdersApiConfig();
    if (!config || !state || draft === null) return;
    setSaving(true);
    const bag = { ...state.bag };
    if (draft) bag[FINISHING_KEY] = draft;
    else delete bag[FINISHING_KEY];
    const res = await updateSpecialistReportExtras(config, poNumber, propertyId, {
      specialistReportExtrasJson: JSON.stringify(bag),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(
        resolveApiError(res.kind, undefined, "تعذّر حفظ مستوى التشطيبات"),
        "error",
      );
      return;
    }
    hydrateSpecialistReportExtrasFromApi(
      propertyId,
      poNumber,
      res.data.specialistReportExtrasJson,
    );
    window.dispatchEvent(
      new CustomEvent(VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT, {
        detail: { propertyId },
      }),
    );
    setState(toState(res.data));
    setDraft(null);
    showToast("تم حفظ مستوى التشطيبات.", "success");
  }, [state, draft, poNumber, propertyId, showToast]);

  let body;
  if (loading) body = <InlineLoadingSkeleton />;
  else if (loadError) body = <Note tone="warn">{loadError}</Note>;
  else {
    body = (
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        <div>
          <RegSelect
            id={`finishing-${propertyId}`}
            label="مستوى تشطيبات البناء"
            placeholder="—"
            value={level}
            options={LEVELS.map((key) => ({
              value: key,
              label: specialistFinishingLevelLabel(key),
            }))}
            disabled={!canEdit}
            onChange={(v) => setDraft(normalizeSpecialistFinishingLevel(v))}
          />
          {written || edited ? (
            <div className="mt-1 flex flex-col gap-0.5 text-[10px] leading-4 text-text-3">
              {written ? <span>{written}</span> : null}
              {edited ? <span className="font-semibold text-text-2">{edited}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold">إضافات التقرير (الأخصائي)</h2>
            <p className="m-0 mt-0.5 text-xs text-text-3">
              مع اسم من اختار المستوى ومن عدّله
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving || !dirty}
              showActionToast={false}
              onClick={() => void save()}
            >
              حفظ
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
}
