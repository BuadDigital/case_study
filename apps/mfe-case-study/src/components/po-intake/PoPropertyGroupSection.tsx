"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Note, useToast } from "@platform/design-system";
import {
  confirmPropertyGroupLink,
  getPropertyGroup,
  suggestPropertyGroupLinks,
  unlinkPropertyGroup,
  type PropertyGroupDto,
  type PropertyGroupSuggestionDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";

/**
 * Decision 20 — العقار المجمع: the system suggests links (same owner / same plan /
 * adjacent plots / coordinate proximity), a human confirms (audited), and the link
 * is reversible with a reason. Work orders stay administratively independent.
 */
export function PoPropertyGroupSection({ propertyId }: { propertyId: string }) {
  const { showToast } = useToast();
  const [group, setGroup] = useState<PropertyGroupDto | null>(null);
  const [suggestions, setSuggestions] = useState<PropertyGroupSuggestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unlinkReason, setUnlinkReason] = useState("");

  const reload = useCallback(async () => {
    const config = workOrdersApiConfig();
    if (!config || !propertyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [groupRes, suggestRes] = await Promise.all([
      getPropertyGroup(config, propertyId),
      suggestPropertyGroupLinks(config, propertyId),
    ]);
    setLoading(false);
    if (groupRes.ok) setGroup(groupRes.data);
    if (suggestRes.ok) setSuggestions(suggestRes.data);
  }, [propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirm(targetPropertyId: string) {
    const config = workOrdersApiConfig();
    if (!config) return;
    setBusy(true);
    const res = await confirmPropertyGroupLink(config, propertyId, targetPropertyId);
    setBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تأكيد الربط", "error");
      return;
    }
    showToast("تم تأكيد الربط — مسجَّل في سجل التدقيق", "success");
    await reload();
  }

  async function unlink() {
    const config = workOrdersApiConfig();
    if (!config) return;
    if (!unlinkReason.trim()) {
      showToast("مبرر فك الربط إلزامي", "error");
      return;
    }
    setBusy(true);
    const res = await unlinkPropertyGroup(config, propertyId, unlinkReason.trim());
    setBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر فك الربط", "error");
      return;
    }
    showToast("تم فك الربط بمبرر — مسجَّل في التدقيق", "success");
    setUnlinkReason("");
    await reload();
  }

  if (!propertyId || loading) return null;
  if (!group && suggestions.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="m-0 text-[12px] font-bold text-heading">
        العقار المجمع — صكوك متفرقة لعقار واحد
      </p>

      {group ? (
        <div className="mt-2">
          <Note tone="info">
            هذا الصك مرتبط بمجمع من {group.members.length} صكوك — أوامر العمل تبقى مستقلة
            إداريًا والتقرير النهائي شامل واحد.
          </Note>
          <ul className="mt-2 flex flex-col gap-1 text-[12px] text-text-2">
            {group.members.map((m) => (
              <li key={m.propertyId}>
                صك {m.deedNumber} · أمر {m.poNumber} · {m.deedKind ?? "—"}
                {m.signalLabelsAr.length > 0
                  ? ` · إشارات: ${m.signalLabelsAr.join("، ")}`
                  : ""}
              </li>
            ))}
          </ul>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="مبرر فك الربط (إلزامي)"
              value={unlinkReason}
              disabled={busy}
              onChange={(e) => setUnlinkReason(e.target.value)}
              className="text-xs"
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void unlink()}>
              فك ربط هذا الصك
            </Button>
          </div>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-2">
          <p className="m-0 text-[11px] font-semibold text-text-2">
            اقتراحات الربط — التأكيد بشري ويُسجَّل في التدقيق:
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li
                key={s.propertyId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-2 py-1.5 text-[12px]"
              >
                <span className="text-text-2">
                  صك {s.deedNumber} · أمر {s.poNumber}
                  {s.ownerName ? ` · ${s.ownerName}` : ""}
                  {" — "}
                  <strong>{s.signalLabelsAr.join("، ")}</strong>
                  {s.existingGroupId ? " (ضمن مجمع قائم)" : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void confirm(s.propertyId)}
                >
                  تأكيد الربط
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
