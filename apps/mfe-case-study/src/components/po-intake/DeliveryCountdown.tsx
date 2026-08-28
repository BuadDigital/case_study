"use client";

import { cn } from "@platform/ui-kit";
import { useTickingNow } from "@platform/app-shared/hooks/use-ticking-now";
import {
  formatLiveDeliveryCountdown,
  isDeliveryCountdownUrgent,
} from "../../lib/prototype/delivery-countdown";

/** Live SLA countdown — matches countdown-المتبقي-للتسليم.md */
export function DeliveryCountdown({
  dueIso,
  className,
  terminal,
}: {
  dueIso: string;
  className?: string;
  /** PO finished → show em dash */
  terminal?: boolean;
}) {
  // الساعة المشتركة — كانت كل خلية عدّ تنازلي تدير interval خاصاً بها.
  const nowMs = useTickingNow();

  if (terminal) {
    return <span className={cn("text-[13px] font-medium text-text-3", className)}>—</span>;
  }

  const now = new Date(nowMs);
  const label = formatLiveDeliveryCountdown(dueIso, now);
  const urgent = isDeliveryCountdownUrgent(dueIso, now);

  return (
    <span
      className={cn(
        "text-[13px] font-medium [direction:ltr] [unicode-bidi:isolate]",
        urgent ? "text-[#d9694f]" : "text-text",
        className,
      )}
      title="المتبقي حتى موعد تسليم دراسة الحالة"
    >
      {label}
    </span>
  );
}
