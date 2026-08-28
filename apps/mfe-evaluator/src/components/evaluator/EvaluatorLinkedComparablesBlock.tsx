"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getApiBase,
  listPropertyComparableLinks,
  type PropertyComparableLinkItemDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { cn } from "@platform/ui-kit";
import { valTableTdClassName, valTableThClassName } from "./EvaluatorHtmlPrimitives";
import { apiConfig } from "@platform/app-shared/auth/api-config";

function dealLabel(item: PropertyComparableLinkItemDto): string {
  const row = item.comparable;
  if (row.transactionKind === "executed") return row.transactionKindLabelAr || "صفقة منفّذة";
  const price = row.priceDescriptionLabelAr || "حد";
  return `عرض ${price}`;
}

function coords(item: PropertyComparableLinkItemDto): string {
  const { latitude: lat, longitude: lon } = item.comparable;
  if (!lat && !lon) return "—";
  return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;
}

export function EvaluatorLinkedComparablesBlock({
  propertyId,
}: {
  propertyId?: string | null;
}) {
  const [rows, setRows] = useState<PropertyComparableLinkItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const config = apiConfig();
    if (!config || !propertyId) {
      setRows([]);
      return;
    }
    void listPropertyComparableLinks(
      config,
      propertyId,
    ).then((res) => {
      if (!res.ok) {
        setError("تعذّر تحميل المقارنات المربوطة");
        return;
      }
      setError(null);
      setRows(res.data.items);
    });
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!propertyId) {
    return (
      <p className="text-[11px] leading-relaxed text-text-3">
        لا يوجد عقار مرتبط لعرض المقارنات.
      </p>
    );
  }

  if (error) {
    return <p className="text-[11px] leading-relaxed text-text-3">{error}</p>;
  }

  if (!rows.length) {
    return (
      <p className="text-[11px] leading-relaxed text-text-3">
        لم يربط الأخصائي مقارنات بعد. يمكن الاعتماد والتجربة من بنك العقارات عند توفرها.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            {[
              "العقار المقارن (نوعه)",
              "نوع العملية",
              "المساحة (م²)",
              "تاريخ العملية",
              "السعر (ر.س.)",
              "سعر المتر",
              "المدينة",
              "الحي",
              "وصف العقار",
              "الإحداثيات",
            ].map((h) => (
              <th key={h} className={cn(valTableThClassName, "text-start")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.linkId}>
              <td className={valTableTdClassName}>
                {item.comparable.comparablePropertyType || "—"}
              </td>
              <td className={valTableTdClassName}>{dealLabel(item)}</td>
              <td className={valTableTdClassName}>{item.comparable.areaSqm}</td>
              <td className={valTableTdClassName}>{item.comparable.transactionDate}</td>
              <td className={valTableTdClassName}>{item.comparable.price}</td>
              <td className={valTableTdClassName}>{item.comparable.pricePerSqm}</td>
              <td className={valTableTdClassName}>{item.comparable.city || "—"}</td>
              <td className={valTableTdClassName}>{item.comparable.district || "—"}</td>
              <td className={valTableTdClassName}>
                {item.description || item.comparable.description || "—"}
              </td>
              <td className={valTableTdClassName}>{coords(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
