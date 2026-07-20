import React from 'react';
import * as I from './icons.jsx';

export default function Header({ search, onSearch }) {
  return (
    <header className="flex items-center justify-between gap-[18px] px-[30px] py-[14px] bg-white border-b border-line shrink-0 z-[5]">
      <div>
        <div className="flex items-center gap-[7px] text-[12px] text-ink3">
          <span>لوحة التحكم</span>
          <I.ChevronLeft size={13} sw={2} />
          <span>دراسة الحالة</span>
          <I.ChevronLeft size={13} sw={2} />
          <span className="text-goldD font-bold">أوامر العمل</span>
        </div>
        <h1 className="text-[20px] font-extrabold mt-1 text-ink tracking-tight">أوامر العمل (PO)</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex items-center">
          <span className="absolute inset-inline-start-3 text-ink3 pointer-events-none" style={{ insetInlineStart: 12 }}>
            <I.Search size={16} sw={1.8} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="بحث: صك أو أمر عمل..."
            className="w-[280px] py-[9px] pe-[38px] ps-[14px] border border-line2 rounded-lg bg-surface2 text-[13px] outline-none transition focus:border-gold focus:shadow-[0_0_0_3px_rgba(164,144,111,.22)]"
          />
        </div>

        <button className="flex items-center gap-[7px] h-[38px] px-[13px] border border-line2 rounded-lg bg-white text-ink2 text-[13px] font-medium transition hover:border-gold hover:text-goldD">
          <I.Download size={16} sw={1.8} />
          <span>تصدير</span>
        </button>

        <button className="relative w-[38px] h-[38px] grid place-items-center border border-line2 rounded-lg bg-white text-ink2 transition hover:bg-surface2 hover:text-ink">
          <I.Bell size={18} />
          <span className="absolute top-2 inset-inline-end-[9px] w-[7px] h-[7px] rounded-full bg-danger border-2 border-white" style={{ insetInlineEnd: 9 }} />
        </button>

        <div className="w-px h-[26px] bg-line2" />

        <div className="flex items-center gap-[10px] ps-[10px] pe-[6px] py-1 rounded-lg cursor-pointer transition hover:bg-surface2">
          <div className="w-[34px] h-[34px] rounded-lg grid place-items-center bg-ink text-gold2 font-bold text-[14px]">س</div>
          <div className="leading-tight">
            <b className="text-[13px] font-bold text-ink block">سليمان</b>
            <span className="text-[11px] text-ink3">المسؤول</span>
          </div>
        </div>

        <button className="flex items-center gap-[7px] h-[38px] px-[13px] border border-line2 rounded-lg bg-white text-ink2 text-[13px] font-medium transition hover:border-danger hover:text-danger">
          <I.Logout size={16} sw={1.8} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </header>
  );
}
