"use client";

import { useEffect, useState } from "react";
import {
  Button,
  FormGroup,
  Label,
  Note,
  useToast,
} from "@platform/design-system";
import { RegField } from "@platform/app-shared/registration/FormFields";
import type { PartyFeePricingDto } from "@platform/api-client";
import {
  loadPartyFeePricing,
  savePartyFeePricingConfig,
} from "../lib/financial-api";

const EMPTY: PartyFeePricingDto = {
  engineeringSurveyFeeSar: 0,
  governmentReviewFeeSar: 0,
  keyReceiptFeeSar: 0,
  fieldInspectorIndividualFeeSar: 0,
  fieldInspectorOrganizationFeeSar: 0,
  fieldInspectorEmployeeFeeSar: 0,
};

function num(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function FinancePartyFeePricing() {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<PartyFeePricingDto>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const locked = loading || saving;

  useEffect(() => {
    let cancelled = false;
    void loadPartyFeePricing()
      .then((row) => {
        if (!cancelled) setDraft(row);
      })
      .catch(() => {
        if (!cancelled) {
          showToast("تعذّر تحميل تسعير الأتعاب", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await savePartyFeePricingConfig(draft);
      setDraft(saved);
      showToast("تم حفظ تسعير الأتعاب", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حفظ التسعير",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Note tone="info">
        تسعير الأتعاب الافتراضي لمزوّدي الخدمة وأتعاب استلام المفاتيح من إنفاذ.
        لا يظهر بند استلام المفاتيح في شاشات صرف الأطراف.
      </Note>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormGroup>
          <Label className="text-[11px] font-semibold text-text-2">
            أتعاب استلام المفاتيح (ر.س)
          </Label>
          <RegField
            id="fee-key-receipt"
            label=""
            value={String(draft.keyReceiptFeeSar || "")}
            readOnly={locked}
            onChange={(v) =>
              setDraft((d) => ({ ...d, keyReceiptFeeSar: num(v) }))
            }
          />
        </FormGroup>
        <FormGroup>
          <Label className="text-[11px] font-semibold text-text-2">
            أتعاب المراجعة الحكومية (ر.س)
          </Label>
          <RegField
            id="fee-gov-review"
            label=""
            value={String(draft.governmentReviewFeeSar || "")}
            readOnly={locked}
            onChange={(v) =>
              setDraft((d) => ({ ...d, governmentReviewFeeSar: num(v) }))
            }
          />
        </FormGroup>
        <FormGroup>
          <Label className="text-[11px] font-semibold text-text-2">
            أتعاب الرفع المساحي (ر.س)
          </Label>
          <RegField
            id="fee-survey"
            label=""
            value={String(draft.engineeringSurveyFeeSar || "")}
            readOnly={locked}
            onChange={(v) =>
              setDraft((d) => ({ ...d, engineeringSurveyFeeSar: num(v) }))
            }
          />
        </FormGroup>
        <FormGroup>
          <Label className="text-[11px] font-semibold text-text-2">
            معاين — فرد (ر.س)
          </Label>
          <RegField
            id="fee-insp-ind"
            label=""
            value={String(draft.fieldInspectorIndividualFeeSar || "")}
            readOnly={locked}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                fieldInspectorIndividualFeeSar: num(v),
              }))
            }
          />
        </FormGroup>
        <FormGroup>
          <Label className="text-[11px] font-semibold text-text-2">
            معاين — منشأة (ر.س)
          </Label>
          <RegField
            id="fee-insp-org"
            label=""
            value={String(draft.fieldInspectorOrganizationFeeSar || "")}
            readOnly={locked}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                fieldInspectorOrganizationFeeSar: num(v),
              }))
            }
          />
        </FormGroup>
        <FormGroup>
          <Label className="text-[11px] font-semibold text-text-2">
            معاين — موظف (ر.س)
          </Label>
          <RegField
            id="fee-insp-emp"
            label=""
            value={String(draft.fieldInspectorEmployeeFeeSar || "")}
            readOnly={locked}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                fieldInspectorEmployeeFeeSar: num(v),
              }))
            }
          />
        </FormGroup>
      </div>
      <div className="flex justify-end">
        <Button type="button" disabled={locked} onClick={() => void save()}>
          {saving ? "جاري الحفظ…" : "حفظ التسعير"}
        </Button>
      </div>
    </div>
  );
}
