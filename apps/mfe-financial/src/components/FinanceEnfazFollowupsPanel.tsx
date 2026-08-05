"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  createEnfazFollowup,
  loadEnfazFollowups,
  markEnfazFinanceFlag,
  unmarkEnfazFinanceFlag,
} from "@platform/app-shared/prototype/enfaz-billing-api";
import { useToast } from "@platform/design-system";
import {
  finEmpty,
  finEmptyS,
  finEmptyT,
  finFld,
  finFldLbl,
  finFormGrid,
  finGhost,
  finMuted,
  finNote,
  finPrimary,
  finScrollY,
} from "../lib/finance-tw";

export function FinanceEnfazFollowupsPanel({ poNumber }: { poNumber: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [channel, setChannel] = useState("call");
  const [notes, setNotes] = useState("");
  const [dateIso, setDateIso] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);

  const followupsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "followups", poNumber],
    queryFn: () => loadEnfazFollowups(poNumber),
    enabled: Boolean(poNumber.trim()),
  });

  const entries = followupsQuery.data ?? [];

  const save = async () => {
    if (!notes.trim()) return;
    setBusy(true);
    try {
      const followedAtUtc = dateIso
        ? new Date(`${dateIso}T12:00:00.000Z`).toISOString()
        : undefined;
      const entry = await createEnfazFollowup(poNumber, {
        channel,
        notes: notes.trim(),
        followedAtUtc,
      });
      if (!entry) {
        showToast("تعذّر حفظ المتابعة", "error");
        return;
      }
      setNotes("");
      showToast("تم تسجيل المتابعة", "success");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            ...prototypeKeys.all,
            "enfaz-billing",
            "followups",
            poNumber,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking"],
        }),
      ]);
    } finally {
      setBusy(false);
    }
  };

  const setFlag = async (
    flag: "stopped" | "excluded" | "difficult" | "clear",
  ) => {
    setBusy(true);
    try {
      const ok =
        flag === "clear"
          ? await unmarkEnfazFinanceFlag(poNumber)
          : await markEnfazFinanceFlag(poNumber, { flag });
      if (!ok) {
        showToast("تعذّر تحديث حالة المعاملة", "error");
        return;
      }
      showToast(
        flag === "clear"
          ? "أُزيلت العلامة — تُعاد للمعادلة الآلية"
          : flag === "excluded"
            ? "أُعلنت مستبعدة"
            : "أُعلنت متوقفة",
        "success",
      );
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking"],
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className={finNote}>
        سجّل محاولات المطالبة (محفوظة على الخادم). يمكن أيضاً إيقاف أو استبعاد
        المعاملة يدوياً عندما يتعذّر مركز التصفية.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={finGhost}
          disabled={busy}
          onClick={() => void setFlag("stopped")}
        >
          تعليم متوقفة
        </button>
        <button
          type="button"
          className={finGhost}
          disabled={busy}
          onClick={() => void setFlag("difficult")}
        >
          متعذّرة من المركز
        </button>
        <button
          type="button"
          className={finGhost}
          disabled={busy}
          onClick={() => void setFlag("excluded")}
        >
          استبعاد نهائي
        </button>
        <button
          type="button"
          className={finGhost}
          disabled={busy}
          onClick={() => void setFlag("clear")}
        >
          إزالة العلامة
        </button>
      </div>

      <div className={finFormGrid}>
        <label className={finFld}>
          <span className={finFldLbl}>التاريخ</span>
          <input
            type="date"
            className="min-h-[38px] rounded-lg border border-border-md bg-surface px-3 font-[inherit] text-[13px] text-text outline-none focus:border-gold"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            dir="ltr"
          />
        </label>
        <label className={finFld}>
          <span className={finFldLbl}>القناة</span>
          <select
            className="min-h-[38px] rounded-lg border border-border-md bg-surface px-3 font-[inherit] text-[13px] text-text outline-none focus:border-gold"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="call">اتصال</option>
            <option value="email">بريد</option>
            <option value="portal">بوابة إنفاذ</option>
            <option value="visit">زيارة</option>
            <option value="other">أخرى</option>
          </select>
        </label>
      </div>

      <label className={`${finFld} mt-3`}>
        <span className={finFldLbl}>ملاحظات المتابعة *</span>
        <textarea
          className="min-h-[72px] resize-y rounded-lg border border-border-md bg-surface px-3 py-2 font-[inherit] text-[13px] text-text outline-none focus:border-gold"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: اتُصل بمركز التصفية — وعد بالرفع خلال أسبوع"
        />
      </label>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className={finPrimary}
          disabled={!notes.trim() || busy}
          onClick={() => void save()}
        >
          إضافة متابعة
        </button>
      </div>

      {followupsQuery.isPending ? (
        <div className={finEmpty}>
          <div className={finEmptyT}>جاري تحميل المتابعات…</div>
        </div>
      ) : entries.length === 0 ? (
        <div className={finEmpty}>
          <div className={finEmptyT}>لا متابعات مسجّلة بعد.</div>
          <div className={finEmptyS}>
            تظهر هنا محاولات الاستدعاء بعد إضافتها.
          </div>
        </div>
      ) : (
        <div className={`${finScrollY} mt-3 max-h-[200px] border border-border`}>
          <ul className="m-0 list-none divide-y divide-border p-0">
            {entries.map((e) => (
              <li key={e.id} className="px-3.5 py-2.5 text-start">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span
                    className="font-bold tabular-nums text-heading"
                    dir="ltr"
                  >
                    {(e.followedAtUtc || "").slice(0, 10) || "—"}
                  </span>
                  <span className={finGhost}>{e.channelLabel || e.channel}</span>
                </div>
                <p className={`${finMuted} mt-1 whitespace-pre-wrap`}>
                  {e.notes}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
