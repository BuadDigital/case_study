"use client";

import { Badge, cn } from "@platform/design-system";
import {
  SCREEN_CATALOG_KIND_LABELS,
  SCREEN_CATALOG_STATUS_LABELS,
  humanizeScreenPath,
  screenCatalogRoleGroup,
  screenCatalogRoleLabel,
  type SystemScreenEntry,
} from "@platform/app-shared/prototype/screen-catalog";

export function ScreenCatalogDetailPanel({
  screen,
}: {
  screen: SystemScreenEntry;
}) {
  const rolesByGroup = screen.roles.reduce<
    Record<string, typeof screen.roles>
  >((acc, roleId) => {
    const group = screenCatalogRoleGroup(roleId);
    if (!acc[group]) acc[group] = [];
    acc[group].push(roleId);
    return acc;
  }, {});

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
      <header className="border-b border-border pb-3">
        <h3 className="text-sm font-semibold text-text">{screen.name}</h3>
        {screen.whereToFind ? (
          <p className="mt-1.5 text-xs text-text-2">{screen.whereToFind}</p>
        ) : null}
      </header>

      <dl className="mt-4 space-y-3 text-xs">
        <div>
          <dt className="text-text-3">التصنيف</dt>
          <dd className="mt-0.5 text-text">{screen.group}</dd>
        </div>
        <div>
          <dt className="text-text-3">نوع الشاشة</dt>
          <dd className="mt-0.5">
            <Badge tone="info">{SCREEN_CATALOG_KIND_LABELS[screen.kind]}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-text-3">الحالة</dt>
          <dd className="mt-0.5">
            <Badge
              tone={
                screen.status === "جاهزة"
                  ? "success"
                  : "warning"
              }
            >
              {SCREEN_CATALOG_STATUS_LABELS[screen.status]}
            </Badge>
          </dd>
        </div>
        {screen.breadcrumb ? (
          <div>
            <dt className="text-text-3">مسار التنقل في أعلى الصفحة</dt>
            <dd className="mt-0.5 text-text">{screen.breadcrumb}</dd>
          </div>
        ) : null}
        {screen.notes ? (
          <div>
            <dt className="text-text-3">ملاحظة</dt>
            <dd className="mt-0.5 text-text-2">{screen.notes}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-text-3">الرابط التقني (للدعم الفني)</dt>
          <dd className="mt-0.5 font-mono text-[11px] text-text-3" dir="ltr">
            {humanizeScreenPath(screen.path)}
          </dd>
        </div>
      </dl>

      <section className="mt-5 border-t border-border pt-4">
        <h4 className="text-xs font-semibold text-text">
          من يصل لهذه الشاشة؟ ({screen.roles.length})
        </h4>
        <p className="mt-1 text-[11px] text-text-3">
          حسب صلاحيات الدور في النظام
        </p>
        <div className="mt-3 space-y-3">
          {Object.entries(rolesByGroup)
            .sort(([a], [b]) => a.localeCompare(b, "ar"))
            .map(([group, roleIds]) => (
              <div key={group}>
                <p className="mb-1.5 text-[10px] font-medium text-text-3">
                  {group}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {roleIds.map((roleId) => (
                    <li
                      key={roleId}
                      className={cn(
                        "rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] text-text",
                      )}
                    >
                      {screenCatalogRoleLabel(roleId)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
