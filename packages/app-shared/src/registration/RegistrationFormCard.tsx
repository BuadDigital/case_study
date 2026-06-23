"use client";

import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@platform/design-system";

export function RegistrationFormCard({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const showHeader = Boolean(title || subtitle || headerRight);
  if (!showHeader) {
    return <div data-registration-card>{children}</div>;
  }
  return (
    <Card className="mb-4 overflow-hidden shadow-none" data-registration-card>
      {showHeader ? (
        <CardHeader className="bg-surface">
          <div>
            {title ? (
              <h3 className="text-[13px] font-semibold text-text">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="m-0 text-[11px] text-text-3">{subtitle}</p>
            ) : null}
          </div>
          {headerRight ? (
            <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
          ) : null}
        </CardHeader>
      ) : null}
      <CardBody>{children}</CardBody>
    </Card>
  );
}
