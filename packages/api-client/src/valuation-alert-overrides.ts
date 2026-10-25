import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";
import type {
  ValuationReconciliationDto,
  ValuationSelectionsApiConfig,
} from "./valuation-comparable-selections";

export type ValuationAlertOverrideInput = {
  code: string;
  overrideRationale?: string | null;
  acknowledged?: boolean;
};

type AlertOverridesResult =
  | { ok: true; data: ValuationReconciliationDto }
  | {
      ok: false;
      kind: "auth" | "validation" | "server" | "network";
      message?: string;
      errors?: Record<string, string>;
    };

/**
 * Saves the methodology-alert dispositions (rationale / acknowledgement) on their own — the rest of the
 * reconciliation is left as saved, so an acknowledgement never waits on «مبرر استخدام طرق التقييم».
 * Codes sent replace their stored disposition; codes not sent are kept.
 */
export async function saveValuationAlertOverrides(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  overrides: ValuationAlertOverrideInput[],
): Promise<AlertOverridesResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/reconciliation/alert-overrides`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify({ methodologyAlertOverrides: overrides }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400 || res.status === 403 || res.status === 409) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        message?: string;
        detail?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          (payload?.errors ? Object.values(payload.errors)[0] : undefined) ??
          payload?.message ??
          payload?.detail ??
          "تعذّر حفظ معالجة التنبيه",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationReconciliationDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
