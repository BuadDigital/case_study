import { cn, MobileSectionPicker } from "@platform/ui-kit";
import {
  finStageCount,
  finStageCountOn,
  finStagePill,
  finStagePillOn,
  finStagePills,
} from "../lib/finance-tw";

/**
 * Finance stage buttons — padding 8×15 · 12.5px · badge 18 — matches HTML data-rvtab.
 */
export function FinanceStagePills<T extends string>({
  items,
  active,
  onChange,
  onTabIntent,
  counts,
  className,
  pickerTitle = "المرحلة",
}: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  /** Pointer or keyboard focus reached a tab — warm its data before the click. */
  onTabIntent?: (id: T) => void;
  counts?: Partial<Record<T, number>>;
  className?: string;
  /** Phone picker caption / sheet title. */
  pickerTitle?: string;
}) {
  return (
    <>
    {/* Phones: a section picker, not the pill row wrapped over several lines. */}
    <MobileSectionPicker
      className={cn("mb-3.5 lg:hidden", className)}
      title={pickerTitle}
      sections={items.map((item) => ({
        id: item.id,
        label: item.label,
        count: counts?.[item.id],
      }))}
      active={active}
      onChange={(id) => onChange(id as T)}
    />
    <div className={cn(finStagePills, "max-lg:hidden", className)} role="tablist">
      {items.map((item) => {
        const count = counts?.[item.id];
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-no-action-toast
            className={isActive ? finStagePillOn : finStagePill}
            onClick={() => onChange(item.id)}
            onPointerEnter={
              onTabIntent && !isActive ? () => onTabIntent(item.id) : undefined
            }
            onFocus={
              onTabIntent && !isActive ? () => onTabIntent(item.id) : undefined
            }
          >
            <span className="whitespace-nowrap">{item.label}</span>
            {count != null ? (
              <span
                className={isActive ? finStageCountOn : finStageCount}
                dir="ltr"
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
    </>
  );
}
