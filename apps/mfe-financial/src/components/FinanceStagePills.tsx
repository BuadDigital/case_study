import { cn } from "@platform/ui-kit";
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
  counts,
  className,
}: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  counts?: Partial<Record<T, number>>;
  className?: string;
}) {
  return (
    <div className={cn(finStagePills, className)} role="tablist">
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
  );
}
