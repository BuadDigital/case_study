"use client";

/**
 * Generic settings-card bodies: the communications (OTP / SMS / SMTP) form
 * with its test-send row, and the SLA + valuation thresholds form. Both edit
 * the draft through the workflow's patch helpers.
 */

import type { ReactNode } from "react";
import {
  Spinner,
  cn,
  opsBtnGhost,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFormGrid,
  opsTfLbl,
  opsTfNote,
} from "@platform/ui-kit";
import {
  numberOr,
  SETTINGS_NUMBER_FALLBACKS as FALLBACK,
} from "./organization-settings-state";
import type { OrganizationSettingsWorkflow } from "./useOrganizationSettingsWorkflow";

function Field({
  id,
  label,
  full,
  children,
}: {
  id: string;
  label: ReactNode;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? opsFldFull : opsFld}>
      <label htmlFor={id} className={opsTfLbl}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function OrganizationCommunicationsForm({
  workflow,
}: {
  workflow: OrganizationSettingsWorkflow;
}) {
  const {
    canEdit,
    draft,
    patchCommunications,
    testDestination,
    setTestDestination,
    testing,
    runTest,
  } = workflow;
  const c = draft.communications;
  return (
    <>
      <p className={cn(opsTfNote, "m-0 mb-3.5")}>
        واجهة موحّدة لإرسال OTP والدعوات. الافتراضي <code>dev-log</code>{" "}
        يكتب الرمز في سجل الخادم. مفاتيح API وكلمات مرور SMTP لا تُعاد في
        الاستجابة — اترك الحقل فارغاً للإبقاء على القيمة الحالية.
      </p>
      <div className={opsFormGrid}>
        <Field id="org-otp-provider" label="مزوّد OTP">
          <select
            id="org-otp-provider"
            className={opsFldControl}
            value={c.otpProvider}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ otpProvider: e.target.value })}
          >
            <option value="dev-log">dev-log (تطوير)</option>
            <option value="sms">sms</option>
            <option value="email">email</option>
          </select>
        </Field>
        <Field id="org-otp-channel" label="قناة OTP الافتراضية">
          <select
            id="org-otp-channel"
            className={opsFldControl}
            value={c.defaultOtpChannel}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ defaultOtpChannel: e.target.value })}
          >
            <option value="sms">sms</option>
            <option value="email">email</option>
          </select>
        </Field>
        <Field id="org-sms-sender" label="معرّف مرسل SMS">
          <input
            id="org-sms-sender"
            className={opsFldControl}
            dir="ltr"
            value={c.smsSenderId ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ smsSenderId: e.target.value })}
          />
        </Field>
        <Field id="org-email-from" label="بريد المرسل">
          <input
            id="org-email-from"
            className={opsFldControl}
            dir="ltr"
            value={c.emailFrom ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ emailFrom: e.target.value })}
          />
        </Field>
        <Field id="org-sms-api-url" label="عنوان API للرسائل (SMS)" full>
          <input
            id="org-sms-api-url"
            className={opsFldControl}
            dir="ltr"
            placeholder="https://…"
            value={c.smsApiUrl ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ smsApiUrl: e.target.value })}
          />
        </Field>
        <Field
          id="org-sms-api-key"
          full
          label={
            <>
              مفتاح API للرسائل
              {c.smsApiKeyConfigured ? " (محفوظ — اترك فارغاً للإبقاء)" : ""}
            </>
          }
        >
          <input
            id="org-sms-api-key"
            className={opsFldControl}
            dir="ltr"
            type="password"
            autoComplete="new-password"
            placeholder={c.smsApiKeyConfigured ? "••••••••" : ""}
            value={c.smsApiKey ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ smsApiKey: e.target.value })}
          />
        </Field>
        <Field id="org-smtp-host" label="خادم SMTP">
          <input
            id="org-smtp-host"
            className={opsFldControl}
            dir="ltr"
            value={c.smtpHost ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ smtpHost: e.target.value })}
          />
        </Field>
        <Field id="org-smtp-port" label="منفذ SMTP">
          <input
            id="org-smtp-port"
            className={opsFldControl}
            dir="ltr"
            type="number"
            value={String(c.smtpPort ?? FALLBACK.smtpPort)}
            disabled={!canEdit}
            onChange={(e) =>
              patchCommunications({
                smtpPort: numberOr(e.target.value, FALLBACK.smtpPort),
              })
            }
          />
        </Field>
        <Field id="org-smtp-user" label="مستخدم SMTP">
          <input
            id="org-smtp-user"
            className={opsFldControl}
            dir="ltr"
            value={c.smtpUsername ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ smtpUsername: e.target.value })}
          />
        </Field>
        <Field
          id="org-smtp-password"
          label={
            <>
              كلمة مرور SMTP
              {c.smtpPasswordConfigured ? " (محفوظة)" : ""}
            </>
          }
        >
          <input
            id="org-smtp-password"
            className={opsFldControl}
            dir="ltr"
            type="password"
            autoComplete="new-password"
            placeholder={c.smtpPasswordConfigured ? "••••••••" : ""}
            value={c.smtpPassword ?? ""}
            disabled={!canEdit}
            onChange={(e) => patchCommunications({ smtpPassword: e.target.value })}
          />
        </Field>
      </div>

      <div className={cn(opsTfNote, "mt-4 flex flex-wrap items-end gap-2.5")}>
        <div className={cn(opsFld, "min-w-[12rem] flex-1")}>
          <label htmlFor="org-test-destination" className={opsTfLbl}>
            وجهة اختبار (جوال أو بريد)
          </label>
          <input
            id="org-test-destination"
            className={cn(opsFldControl, "bg-surface")}
            dir="ltr"
            value={testDestination}
            disabled={!canEdit}
            onChange={(e) => setTestDestination(e.target.value)}
            placeholder="+9665… أو email@…"
          />
        </div>
        <button
          type="button"
          className={opsBtnGhost}
          disabled={!canEdit || testing || !testDestination.trim()}
          onClick={() => void runTest()}
        >
          {testing ? <Spinner /> : null}
          <span>{testing ? "جاري الإرسال…" : "اختبار الإرسال"}</span>
        </button>
      </div>
    </>
  );
}

export function OrganizationSlaForm({
  workflow,
}: {
  workflow: OrganizationSettingsWorkflow;
}) {
  const { canEdit, draft, patchSla, patchValuation } = workflow;
  const { sla, valuation } = draft;
  return (
    <>
      <p className={cn(opsTfNote, "m-0 mb-3.5")}>
        التعديل يسري على أوامر العمل الجديدة فقط. الجارية تحتفظ بمهلتها
        المحسوبة عند الاستلام.
      </p>
      <div className={opsFormGrid}>
        <Field id="org-sla-default" label="أيام عمل — تنفيذ / تركات">
          <input
            id="org-sla-default"
            className={opsFldControl}
            type="number"
            min={1}
            max={60}
            dir="ltr"
            value={String(sla.defaultBusinessDays)}
            disabled={!canEdit}
            onChange={(e) =>
              patchSla({
                defaultBusinessDays: numberOr(e.target.value, FALLBACK.defaultBusinessDays),
              })
            }
          />
        </Field>
        <Field id="org-sla-private" label="أيام عمل — قطاع خاص">
          <input
            id="org-sla-private"
            className={opsFldControl}
            type="number"
            min={1}
            max={60}
            dir="ltr"
            value={String(sla.privateSectorBusinessDays)}
            disabled={!canEdit}
            onChange={(e) =>
              patchSla({
                privateSectorBusinessDays: numberOr(
                  e.target.value,
                  FALLBACK.privateSectorBusinessDays,
                ),
              })
            }
          />
        </Field>
        <Field id="org-max-adopted-comps" label="الحد الأقصى للمقارنات المعتمدة لكل تقييم">
          <input
            id="org-max-adopted-comps"
            className={opsFldControl}
            type="number"
            min={1}
            max={20}
            dir="ltr"
            value={String(valuation.maxAdoptedComparables)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                maxAdoptedComparables: numberOr(
                  e.target.value,
                  FALLBACK.maxAdoptedComparables,
                ),
              })
            }
          />
        </Field>
        <Field
          id="org-comp-time-gap"
          label="عتبة الفارق الزمني للمقارن (أشهر) — تنبيه تسوية الزمن (ق-4)"
        >
          <input
            id="org-comp-time-gap"
            className={opsFldControl}
            type="number"
            min={1}
            max={60}
            dir="ltr"
            value={String(valuation.comparableTimeGapMonths ?? FALLBACK.comparableTimeGapMonths)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                comparableTimeGapMonths: numberOr(
                  e.target.value,
                  FALLBACK.comparableTimeGapMonths,
                ),
              })
            }
          />
        </Field>
        <Field id="org-area-factor" label="معامل تسوية المساحة ٪ (areaFactor) — منطق التسويات">
          <input
            id="org-area-factor"
            className={opsFldControl}
            type="number"
            min={0.1}
            max={50}
            step={0.1}
            dir="ltr"
            value={String(valuation.areaFactorPct ?? FALLBACK.areaFactorPct)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                areaFactorPct: numberOr(e.target.value, FALLBACK.areaFactorPct),
              })
            }
          />
        </Field>
        <Field id="org-mkt-rate" label="معدل تغير السوق السنوي ٪ (mktRate) — اقتراح ظروف السوق">
          <input
            id="org-mkt-rate"
            className={opsFldControl}
            type="number"
            min={0}
            max={50}
            step={0.1}
            dir="ltr"
            value={String(valuation.annualMarketRatePct ?? 4)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                annualMarketRatePct: numberOr(e.target.value, FALLBACK.annualMarketRatePct),
              })
            }
          />
        </Field>
        <Field id="org-value-round" label="أسّ تقريب قيمة السوق (١٠^ن) — منطق التسويات">
          <input
            id="org-value-round"
            className={opsFldControl}
            type="number"
            min={0}
            max={6}
            dir="ltr"
            value={String(valuation.marketValueRoundDecimals ?? 4)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                marketValueRoundDecimals: numberOr(
                  e.target.value,
                  FALLBACK.marketValueRoundDecimals,
                ),
              })
            }
          />
        </Field>
      </div>
    </>
  );
}
