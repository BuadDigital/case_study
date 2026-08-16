"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OperationsTaskDto } from "@platform/api-client";
import { opsTaskScopeText, opsTaskTypeLabel, taskCountdown } from "../../lib/dashboard-metrics";
import { dashCard, dashIco, dashLine } from "../../lib/dashboard-tw";
import { cn } from "@platform/design-system";
import { TaskTypeIcon } from "./DashIcons";

export function DashActionQueue({
  tasks,
}: {
  tasks: OperationsTaskDto[];
}) {
  const router = useRouter();
  const rows = [...tasks]
    .sort(
      (a, b) =>
        (Date.parse(a.dueAt) || 0) - (Date.parse(b.dueAt) || 0),
    )
    .slice(0, 5);

  return (
    <div className={dashCard}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-bold text-heading">
          ما يتطلب إجراءك الآن
        </h3>
        <Link
          href="/operations-tasks"
          className="text-[12px] font-bold text-heading no-underline hover:underline"
        >
          عرض الكل
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="py-2 text-[12.5px] text-text-3">
          لا توجد مهام مفتوحة.
        </div>
      ) : (
        rows.map((t) => {
          const cd = taskCountdown(t.dueAt);
          return (
            <div
              key={t.id}
              className={cn(dashLine, "cursor-pointer")}
              role="button"
              tabIndex={0}
              onClick={() => router.push("/operations-tasks")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/operations-tasks");
                }
              }}
            >
              <span className={cn(dashIco, "bg-gold-soft text-gold-d")}>
                <TaskTypeIcon type={t.type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-heading">
                  {t.title}
                </div>
                <div className="text-[11.5px] text-text-3">
                  {opsTaskTypeLabel(t.type)} · {opsTaskScopeText(t)}
                </div>
              </div>
              <span
                className="whitespace-nowrap text-[12px] font-bold"
                style={{ color: cd.over ? "#d9694f" : "var(--text-2)" }}
              >
                {cd.txt}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
