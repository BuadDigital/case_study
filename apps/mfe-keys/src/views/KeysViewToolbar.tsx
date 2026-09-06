"use client";

/** Toolbar over the keys list — title, result chip, search, custody eye, status filter, register button. */
import {
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  ShowAllEye,
  cn,
  opsBtnGhost,
  opsChip,
} from "@platform/ui-kit";
import { preloadRegisterKeyEnvelopeModal } from "./KeysViewModals";
import type { StatusFilter } from "./keys-view-state";

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function KeysViewToolbar({
  ready,
  resultCount,
  search,
  onSearch,
  showOut,
  eyeBlink,
  onToggleShowOut,
  statusFilter,
  onStatusFilter,
  canRegisterEnvelope,
  onRegister,
}: {
  ready: boolean;
  resultCount: number;
  search: string;
  onSearch: (value: string) => void;
  showOut: boolean;
  eyeBlink: boolean;
  onToggleShowOut: () => void;
  statusFilter: StatusFilter;
  onStatusFilter: (value: StatusFilter) => void;
  canRegisterEnvelope: boolean;
  onRegister: () => void;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <h2 className="m-0 text-[17px] font-extrabold text-heading">
          ظروف المفاتيح
        </h2>
        <span className={opsChip}>{ready ? `${resultCount} نتيجة` : "…"}</span>
      </div>
      <div className="filters flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5 max-lg:w-full max-lg:flex-[1_1_100%]">
        <OperationalToolbarSearch
          type="text"
          placeholder="رقم الطلب أو المحكمة أو الصك..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="بحث الظروف"
          className="max-lg:min-w-0 max-lg:flex-1"
        />
        <button
          type="button"
          className={cn(
            opsBtnGhost,
            "show-all-btn-motion h-[38px] px-3.5 text-[12.5px] max-lg:flex-1",
          )}
          onClick={onToggleShowOut}
        >
          <ShowAllEye open={showOut} blink={eyeBlink} />
          <span className="max-sm:hidden">
            {showOut
              ? "إخفاء المسلَّمة (خارج العهدة)"
              : "إظهار المسلَّمة (خارج العهدة)"}
          </span>
          <span className="sm:hidden">
            {showOut ? "إخفاء المسلَّمة" : "إظهار المسلَّمة"}
          </span>
        </button>
        <OperationalToolbarSelect
          className="h-[38px] shrink-0 max-lg:min-w-0 max-lg:flex-1"
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as StatusFilter)}
          aria-label="تصفية العهدة"
        >
          <option value="all">كل حالات العهدة</option>
          <option value="reviewer">بعهدة المراجع</option>
          <option value="assessor">بعهدة المعاين</option>
          <option value="external">بعهدة طرف خارجي</option>
          <option value="returned">مُرجَع للمحكمة</option>
        </OperationalToolbarSelect>
        {canRegisterEnvelope ? (
          <OperationalToolbarPrimaryButton
            className="h-[38px] max-lg:w-full"
            onClick={onRegister}
            onMouseEnter={preloadRegisterKeyEnvelopeModal}
            onFocus={preloadRegisterKeyEnvelopeModal}
          >
            <PlusIcon />
            تسجيل ظرف مفاتيح
          </OperationalToolbarPrimaryButton>
        ) : null}
      </div>
    </div>
  );
}
