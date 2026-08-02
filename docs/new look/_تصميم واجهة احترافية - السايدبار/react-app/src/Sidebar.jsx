import React from 'react';
import Logo from './Logo.jsx';
import * as I from './icons.jsx';

const NavItem = ({ icon: Icon, label, active, badge }) => (
  <div
    className={
      'relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] cursor-pointer transition-colors ' +
      (active
        ? 'font-bold text-gold2 bg-gold/[.18]'
        : 'font-medium text-[#aeb6c4] hover:bg-white/[.06] hover:text-white')
    }
  >
    {active && (
      <span className="absolute inset-inline-start-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full bg-gold" style={{ insetInlineStart: 0 }} />
    )}
    <Icon size={18} />
    <span>{label}</span>
    {badge != null && (
      <span className="ms-auto grid place-items-center min-w-[19px] h-[19px] px-[5px] rounded-full bg-danger text-white text-[11px] font-bold">
        {badge}
      </span>
    )}
  </div>
);

const GroupLabel = ({ children }) => (
  <div className="text-[11px] font-bold tracking-wide text-[#6f7b90] px-3 mt-[18px] mb-[7px]">{children}</div>
);

export default function Sidebar() {
  return (
    <aside className="bg-ink h-screen flex flex-col overflow-hidden">
      <div className="p-[18px] pt-5 border-b border-white/[.08] shrink-0">
        <div className="px-1 py-[6px] flex items-center justify-center">
          <Logo white className="w-[155px] h-auto block" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 pb-[22px]">
        <NavItem icon={I.Grid} label="لوحة التحكم" />

        <GroupLabel>قسم دراسة الحالة</GroupLabel>
        <NavItem icon={I.Clipboard} label="أوامر العمل (PO)" active />
        <NavItem icon={I.List} label="جميع المعاملات" />
        <NavItem icon={I.Activity} label="المعاملات النشطة" />
        <NavItem icon={I.Pin} label="مكاتب الرفع الهندسي" />
        <NavItem icon={I.Key} label="إدارة المفاتيح" />
        <NavItem icon={I.Alert} label="إدارة التعذرات" badge={3} />
        <NavItem icon={I.Clock} label="المعاملات المعلقة" />

        <GroupLabel>قسم التقييم العقاري</GroupLabel>
        <NavItem icon={I.ClipCheck} label="طلبات التقييم" />

        <GroupLabel>عام</GroupLabel>
        <NavItem icon={I.Book} label="قاموس الحقول المركزي" />
        <NavItem icon={I.Monitor} label="دليل الشاشات" />
        <NavItem icon={I.BarChart} label="التقارير المالية" />
        <NavItem icon={I.TrendUp} label="مؤشرات الأداء" />
        <NavItem icon={I.Wallet} label="الأتعاب والصرف" />
        <NavItem icon={I.Database} label="جميع حقول النظام" />
        <NavItem icon={I.Settings} label="الإعدادات" />
      </nav>
    </aside>
  );
}
