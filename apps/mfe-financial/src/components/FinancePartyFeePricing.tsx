"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormGroup,
  Label,
  Note,
  useToast,
} from "@platform/design-system";
import { Can, useCapability } from "@platform/app-shared/components/Can";
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

function FeeField({
  id,
  label,
  value,
  locked,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  locked: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <FormGroup>
      <Label htmlFor={id} className="mb-1 text-[11px] font-semibold text-text-2">
        {label}
      </Label>
      <RegField
        id={id}
        label=""
        value={String(value || "")}
        readOnly={locked}
        inputMode="decimal"
        dir="ltr"
        onChange={(v) => onChange(num(v))}
      />
    </FormGroup>
  );
}

export function FinancePartyFeePricing() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [draft, setDraft] = useState<PartyFeePricingDto>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const locked = loading || saving || !canEdit;

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
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {!canEdit ? (
        <Note tone="default">
          عرض فقط — تعديل التسعيرة مقصور على المسؤول.
        </Note>
      ) : null}

      <Card className="overflow-hidden shadow-none">
        <CardHeader className="bg-surface">
          <div>
            <h3 className="text-[13px] font-semibold text-text">
              مزوّدو الخدمة وإنفاذ
            </h3>
            <p className="m-0 text-[11px] text-text-3">
              لا يظهر بند استلام المفاتيح في شاشات صرف الأطراف
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FeeField
              id="fee-key-receipt"
              label="أتعاب استلام المفاتيح (ر.س)"
              value={draft.keyReceiptFeeSar}
              locked={locked}
              onChange={(n) =>
                setDraft((d) => ({ ...d, keyReceiptFeeSar: n }))
              }
            />
            <FeeField
              id="fee-gov-review"
              label="أتعاب المراجعة الحكومية (ر.س)"
              value={draft.governmentReviewFeeSar}
              locked={locked}
              onChange={(n) =>
                setDraft((d) => ({ ...d, governmentReviewFeeSar: n }))
              }
            />
            <FeeField
              id="fee-survey"
              label="أتعاب الرفع المساحي (ر.س)"
              value={draft.engineeringSurveyFeeSar}
              locked={locked}
              onChange={(n) =>
                setDraft((d) => ({ ...d, engineeringSurveyFeeSar: n }))
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden shadow-none">
        <CardHeader className="bg-surface">
          <div>
            <h3 className="text-[13px] font-semibold text-text">
              المعاين العقاري
            </h3>
            <p className="m-0 text-[11px] text-text-3">
              حسب نوع التعاقد مع المعاين
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FeeField
              id="fee-insp-ind"
              label="معاين — فرد (ر.س)"
              value={draft.fieldInspectorIndividualFeeSar}
              locked={locked}
              onChange={(n) =>
                setDraft((d) => ({
                  ...d,
                  fieldInspectorIndividualFeeSar: n,
                }))
              }
            />
            <FeeField
              id="fee-insp-org"
              label="معاين — منشأة (ر.س)"
              value={draft.fieldInspectorOrganizationFeeSar}
              locked={locked}
              onChange={(n) =>
                setDraft((d) => ({
                  ...d,
                  fieldInspectorOrganizationFeeSar: n,
                }))
              }
            />
            <FeeField
              id="fee-insp-emp"
              label="معاين — موظف (ر.س)"
              value={draft.fieldInspectorEmployeeFeeSar}
              locked={locked}
              onChange={(n) =>
                setDraft((d) => ({
                  ...d,
                  fieldInspectorEmployeeFeeSar: n,
                }))
              }
            />
          </div>
        </CardBody>
      </Card>

      <Can capability="manage-system-config">
        <div className="flex justify-end border-t border-border pt-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={locked}
            onClick={() => void save()}
          >
            {saving ? "جاري الحفظ…" : "حفظ التسعير"}
          </Button>
        </div>
      </Can>
    </div>
  );
}
