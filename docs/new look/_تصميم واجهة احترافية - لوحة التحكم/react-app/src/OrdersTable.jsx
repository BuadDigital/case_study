import React from 'react';
import * as I from './icons.jsx';
import { STATUS_COLORS, progFill } from './data.js';

const COLS = '150px 120px 120px 92px 92px 184px 124px 122px 122px 170px';

const SortHead = ({ label, k, sortKey, sortDir, onSort, center }) => (
  <div
    onClick={() => onSort(k)}
    className={
      'px-4 py-[14px] flex items-center gap-1 text-[12px] font-bold text-ink whitespace-nowrap cursor-pointer hover:text-goldD ' +
      (center ? 'justify-center' : '')
    }
  >
    {label}
    <span className="text-[11px] text-goldD">{sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
  </div>
);

const Head = ({ label, center }) => (
  <div className={'px-4 py-[14px] flex items-center text-[12px] font-bold text-ink whitespace-nowrap ' + (center ? 'justify-center' : '')}>
    {label}
  </div>
);

function Row({ o }) {
  const sc = STATUS_COLORS[o.status] || STATUS_COLORS['تنفيذ'];
  return (
    <div className="grid items-center border-b border-line transition-colors hover:bg-rowHover" style={{ gridTemplateColumns: COLS }}>
      <div className="px-4 py-[14px] flex items-center min-w-0">
        <a className="text-goldD font-bold text-[13.5px] cursor-pointer hover:underline">{o.po}</a>
      </div>
      <div className="px-4 py-[14px] flex items-center min-w-0 text-[13px] text-ink2">{o.deed}</div>
      <div className="px-4 py-[14px] flex items-center min-w-0">
        <span className="inline-flex items-center px-[11px] py-[3px] rounded-md text-[12px] font-medium bg-surface2 border border-line2 text-ink2">{o.type}</span>
      </div>
      <div className="px-4 py-[14px] flex items-center justify-center font-extrabold text-[14px] text-ink">{o.props}</div>
      <div className="px-4 py-[14px] flex items-center justify-center font-bold text-[13.5px] text-ink2">{o.done}</div>
      <div className="px-4 py-[14px] flex items-center min-w-0">
        <div className="flex items-center gap-[10px] w-full">
          <div className="flex-1 h-[6px] rounded-[3px] bg-ink/10 overflow-hidden">
            <div className="h-full rounded-[3px] transition-[width] duration-500" style={{ width: o.pct + '%', background: progFill(o.pct) }} />
          </div>
          <span className="text-[12px] font-bold text-ink min-w-[32px] text-start">{o.pct}%</span>
        </div>
      </div>
      <div className="px-4 py-[14px] flex items-center min-w-0">
        <span className="inline-flex items-center gap-[6px] px-[11px] py-1 rounded-md text-[12px] font-bold" style={{ background: `color-mix(in srgb, ${sc.base} 14%, transparent)`, color: sc.fg }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: sc.base }} />
          {o.status}
        </span>
      </div>
      <div className="px-4 py-[14px] flex items-center text-[13px] text-ink2 whitespace-nowrap">{o.received}</div>
      <div className="px-4 py-[14px] flex items-center text-[13px] text-ink font-semibold whitespace-nowrap">{o.due}</div>
      <div className="px-4 py-[14px] flex items-center min-w-0">
        {o.specialist ? (
          <div className="flex items-center gap-[9px] min-w-0">
            <span className="w-[28px] h-[28px] rounded-[7px] grid place-items-center bg-ink text-gold2 font-bold text-[12px] shrink-0">{o.specialist.trim().charAt(0)}</span>
            <span className="text-[13px] font-semibold text-ink truncate">{o.specialist}</span>
          </div>
        ) : (
          <span className="text-ink3">—</span>
        )}
      </div>
    </div>
  );
}

export default function OrdersTable({ rows, sortKey, sortDir, onSort }) {
  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1186px]">
          <div className="grid bg-surface2 border-b-2 border-gold" style={{ gridTemplateColumns: COLS }}>
            <Head label="رقم PO" />
            <Head label="رقم الصك" />
            <Head label="نوع الإسناد" />
            <SortHead label="العقارات" k="props" center sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHead label="المكتملة" k="done" center sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHead label="التقدم" k="pct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Head label="الحالة" />
            <SortHead label="تاريخ الاستلام" k="received" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHead label="تاريخ الاستحقاق" k="due" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Head label="الأخصائي" />
          </div>
          {rows.map((o) => <Row key={o.po} o={o} />)}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="px-5 py-[54px] text-center text-ink3">
          <I.Search size={34} sw={1.5} className="mx-auto mb-3 opacity-60" />
          <div className="text-[14px] font-bold text-ink2">لا توجد نتائج مطابقة</div>
          <div className="text-[13px] mt-1">جرّب تعديل كلمة البحث أو الفلاتر</div>
        </div>
      )}
    </div>
  );
}
