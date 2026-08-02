import React from 'react';
import * as I from './icons.jsx';

const Card = ({ icon: Icon, label, value, sub, first, gold }) => (
  <div className={'flex-1 px-6 py-5 border-e border-line last:border-e-0 ' + (first ? 'relative' : '')}>
    {first && <span className="absolute top-0 inset-inline-start-0 w-[3px] h-full bg-gold" style={{ insetInlineStart: 0 }} />}
    <div className="flex items-center gap-[9px] mb-[14px]">
      <span className={'w-[30px] h-[30px] rounded-[7px] grid place-items-center ' + (gold ? 'bg-goldSoft text-goldD' : 'bg-ink/[.08] text-ink')}>
        <Icon size={17} sw={1.8} />
      </span>
      <span className="text-[12.5px] text-ink2 font-medium">{label}</span>
    </div>
    <div className="text-[32px] font-extrabold leading-none text-ink">{value}</div>
    <div className="text-[12px] text-ink3 mt-2 flex items-center gap-[6px]">{sub}</div>
  </div>
);

export default function KpiBand() {
  return (
    <div className="flex bg-white border border-line rounded-xl shadow-card overflow-hidden mb-6">
      <Card
        first
        gold
        icon={I.Clipboard}
        label="إجمالي أوامر العمل"
        value="8"
        sub={<><span className="w-[6px] h-[6px] rounded-full bg-gold" />8 أوامر نشطة</>}
      />
      <Card icon={I.Building} label="عقارات نشطة" value="48" sub="قيد المعالجة" />
      <Card icon={I.Layers} label="متوسط العقارات / PO" value="6.0" sub="عقار لكل أمر" />
      <Card icon={I.CheckCircle} label="مكتملة هذا الشهر" value="0" sub="من 8 إجمالي" />
    </div>
  );
}
