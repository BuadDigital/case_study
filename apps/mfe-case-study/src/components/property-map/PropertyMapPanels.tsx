"use client";

import type { ReactNode } from "react";
import { Button, cn, opsFloatPanel } from "@platform/ui-kit";

import {
  fmtMoney,
  type MapComparableRecord,
  type groupForMap,
} from "../../lib/app-data/map-locations-logic";

/**
 * Presentational pieces of the property map — the layer chips, the layer side
 * panel with its two pickers, the legend dot and the selection detail card.
 * State stays in the view; these only render and call back.
 */

export function LayerPill({
  active,
  label,
  count,
  color,
  diamond,
  menuOpen,
  onClick,
  onMenu,
}: {
  active: boolean;
  label: string;
  count: number;
  color: string;
  diamond?: boolean;
  menuOpen: boolean;
  onClick: () => void;
  onMenu: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-bold transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-[#ddd8cc] bg-white text-text-2 hover:border-gold hover:text-heading",
      )}
    >
      <span
        className="inline-block size-[7px] shrink-0"
        style={{
          background: active ? "#c8b591" : color,
          borderRadius: diamond ? 2 : 99,
          transform: diamond ? "rotate(45deg)" : undefined,
        }}
      />
      {label}
      <span
        className={cn(
          "grid min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold",
          active ? "bg-gold/25 text-gold" : "bg-[#f1ece2] text-gold-d",
        )}
      >
        {count}
      </span>
      {active ? (
        <span
          role="presentation"
          title="اختيار عناصر بعينها"
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          className={cn(
            "grid size-[18px] place-items-center rounded-full",
            menuOpen ? "bg-white/15" : "hover:bg-white/15",
          )}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

export function LayerSidePanel({
  title,
  wide,
  onHide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onHide: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        opsFloatPanel,
        "absolute start-16 top-2.5 z-[960] flex max-h-[380px] flex-col",
        wide ? "w-[320px]" : "w-[250px]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-[#faf8f3] px-3.5 py-2.5">
        <span className="text-[13px] font-extrabold text-heading">{title}</span>
        <button
          type="button"
          onClick={onHide}
          className="ms-auto rounded-lg border border-[#ddd8cc] bg-white px-2.5 py-1 text-[11.5px] font-bold text-text-2 hover:border-[#d9694f] hover:text-[#d9694f]"
        >
          إخفاء الطبقة
        </button>
        <button type="button" onClick={onClose} className="text-[16px] leading-none text-text-3" aria-label="إغلاق">
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}

export function PickerList({
  nodes,
  selectedKeys,
  onSelectedKeys,
  onZoom,
}: {
  nodes: ReturnType<typeof groupForMap>;
  selectedKeys: string[] | null;
  onSelectedKeys: (next: string[] | null) => void;
  onZoom: (point: ReturnType<typeof groupForMap>[number]) => void;
}) {
  const allKeys = nodes.map((n) =>
    n.kind === "group" ? `g:${n.groupId}` : `p:${n.record.id}`,
  );
  const allChecked = !selectedKeys;
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3.5 py-2.5 text-[13px] font-bold text-gold-d">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => onSelectedKeys(allChecked ? [] : null)}
        />
        اختيار الكل ({nodes.length})
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {nodes.map((n) => {
          const key = n.kind === "group" ? `g:${n.groupId}` : `p:${n.record.id}`;
          const head = n.kind === "group" ? n.members[0]! : n.record;
          const checked = !selectedKeys || selectedKeys.includes(key);
          const label =
            n.kind === "group"
              ? `${head.refNo} — ${head.district}، ${head.city} (مجمع ${n.deedCount})`
              : `${head.refNo} — ${head.district}، ${head.city}`;
          return (
            <div key={key} className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-[#faf6ee]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const cur = selectedKeys ?? allKeys;
                  let next = checked ? cur.filter((x) => x !== key) : [...cur, key];
                  if (next.length === allKeys.length) onSelectedKeys(null);
                  else onSelectedKeys(next);
                }}
              />
              <button
                type="button"
                className="text-start text-[12.5px] font-medium text-text hover:text-gold-d"
                onClick={() => onZoom(n)}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function CompPickerList({
  items,
  selectedKeys,
  onSelectedKeys,
  onZoom,
}: {
  items: MapComparableRecord[];
  selectedKeys: string[] | null;
  onSelectedKeys: (next: string[] | null) => void;
  onZoom: (item: MapComparableRecord) => void;
}) {
  const allKeys = items.map((x) => x.id);
  const allChecked = !selectedKeys;
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3.5 py-2.5 text-[13px] font-bold text-gold-d">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => onSelectedKeys(allChecked ? [] : null)}
        />
        اختيار الكل ({items.length})
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {items.map((item) => {
          const checked = !selectedKeys || selectedKeys.includes(item.id);
          return (
            <div key={item.id} className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-[#faf6ee]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const cur = selectedKeys ?? allKeys;
                  const next = checked
                    ? cur.filter((x) => x !== item.id)
                    : [...cur, item.id];
                  if (next.length === allKeys.length) onSelectedKeys(null);
                  else onSelectedKeys(next);
                }}
              />
              <button
                type="button"
                className="text-start text-[12.5px] font-medium text-text hover:text-gold-d"
                onClick={() => onZoom(item)}
              >
                {item.refNo} — {item.comparableType}، {item.district}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function LegendDot({
  color,
  label,
  diamond,
  ring,
}: {
  color: string;
  label: string;
  diamond?: boolean;
  ring?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block border-2 border-white"
        style={{
          width: diamond ? 10 : ring ? 12 : 11,
          height: diamond ? 10 : ring ? 12 : 11,
          background: color,
          borderRadius: diamond ? 2 : 99,
          transform: diamond ? "rotate(45deg)" : undefined,
          boxShadow: ring ? "0 0 0 2px rgba(164,144,111,.6)" : undefined,
        }}
      />
      {label}
    </span>
  );
}

export function DetailCard({
  familyLabel,
  title,
  tags,
  rows,
  nearby,
  isProperty,
  onNearby,
  onClose,
  actionLabel,
  onAction,
}: {
  familyLabel: string;
  title: string;
  tags: ReactNode;
  rows: [string, string][];
  nearby: { item: MapComparableRecord; distanceKm: number }[];
  isProperty?: boolean;
  onNearby?: (item: MapComparableRecord) => void;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <aside className={cn(opsFloatPanel, "absolute bottom-3.5 end-3.5 top-3.5 z-[950] flex w-[330px] max-w-[calc(100%-1.75rem)] flex-col")}>
      <div className="border-b border-border bg-[#faf8f3] px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-md bg-[#f1ece2] px-2 py-0.5 text-[11px] font-bold text-gold-d">
            {familyLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] leading-none text-text-3 hover:text-heading"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          {isProperty ? (
            /* Later: show the transaction photo (photoUrl / first attachment) with lightbox zoom; if no photo, keep this slot and report «no attached photo». */
            <div className="grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#f1ece2] text-[#c2b49a] shadow-[0_4px_12px_-6px_rgba(18,40,76,.45)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <circle cx="12" cy="12.5" r="3.2" />
              </svg>
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-extrabold leading-snug text-heading">{title}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{tags}</div>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-3 border-b border-[#f3f0e9] py-2 text-[12.5px]"
          >
            <span className="shrink-0 text-text-3">{k}</span>
            <span className="text-start font-bold text-text">{v || "-"}</span>
          </div>
        ))}
        {nearby.length > 0 ? (
          <div className="mb-1 mt-2.5">
            <div className="mb-1.5 text-[11.5px] font-bold text-gold-d">مقارنات قريبة (≤ 2 كم)</div>
            <div className="flex flex-col gap-1.5">
              {nearby.map(({ item, distanceKm }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNearby?.(item)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-[#faf8f3] px-2.5 py-2 text-start hover:border-gold hover:bg-[#f1ece2]"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-heading">
                    <span
                      className="size-2 shrink-0 rounded-[2px] bg-[#a4906f]"
                      style={{ transform: "rotate(45deg)" }}
                    />
                    {item.comparableType} — {item.district}
                  </span>
                  <span className="shrink-0 text-[11px] text-gold-d">
                    {distanceKm.toFixed(1)} كم · {item.operationType} · {fmtMoney(item.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <div className="border-t border-border p-3 px-4">
          <Button variant="primary" className="w-full" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
