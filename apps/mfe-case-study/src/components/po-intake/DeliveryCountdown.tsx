"use client";

import { useEffect, useState } from "react";
import { cn } from "@platform/ui-kit";
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (terminal || !dueIso.trim()) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [dueIso, terminal]);

  if (terminal) {
    return <span className={cn("text-[13px] font-medium text-text-3", className)}>—</span>;
  }

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
