"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@platform/design-system";
import {
  PORTAL_CARDS,
  type RegistrationSource,
} from "../prototype/registration-data";

const PORTAL_ICON: Record<RegistrationSource, string> = {
  hr: "bg-success-bg text-primary",
  proc: "bg-info-bg text-info-text",
  crm: "bg-amber-light text-amber-text",
};

const PORTAL_DEPT: Record<RegistrationSource, string> = {
  hr: "text-primary",
  proc: "text-blue",
  crm: "text-amber",
};

export function RegistrationPortal({
  onSelect,
  onBack,
}: {
  onSelect: (source: RegistrationSource) => void;
  onBack: () => void;
}) {
  return (
    <Card className="mb-4 overflow-hidden border-t-[3px] border-t-primary shadow-card">
      <CardHeader>
        <CardTitle>تسجيل المستخدمين</CardTitle>
        <Button type="button" size="sm" onClick={onBack}>
          رجوع للقائمة
        </Button>
      </CardHeader>
      <CardBody className="py-1">
        <div className="mb-6 text-center">
          <h2 className="mb-1 text-lg font-bold text-text">اختر الإدارة المسؤولة</h2>
          <p className="text-xs text-text-3">
            ابدأ تسجيل المستخدم من الإدارة المناسبة حسب نوع الحساب المطلوب
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PORTAL_CARDS.map((card) => (
            <button
              key={card.source}
              type="button"
              className="w-full cursor-pointer rounded-lg border border-border bg-surface p-5 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_4px_16px_rgba(15,52,96,0.12)]"
              onClick={() => onSelect(card.source)}
            >
              <div
                className={`mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-[11px] font-bold tracking-wide ${PORTAL_ICON[card.source]}`}
              >
                {card.icon}
              </div>
              <div
                className={`mb-1 text-[10px] font-bold ${PORTAL_DEPT[card.source]}`}
              >
                {card.dept}
              </div>
              <div className="mb-1.5 text-sm font-bold text-text">
                {card.title}
              </div>
              <div className="mb-2.5 text-[11px] leading-relaxed text-text-3">
                {card.desc}
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-[10px] border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-2"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
