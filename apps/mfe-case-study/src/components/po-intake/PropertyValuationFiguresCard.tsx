"use client";

import type { ReactNode } from "react";
import { fmt } from "@platform/app-shared/format/number";
import {
  useDistrictLandRatesQuery,
  usePropertyValuationFiguresQuery,
} from "@platform/app-shared/query/property-valuation-figures-query";
import type { DistrictLandRate } from "@platform/app-shared/domain/valuation-figures";
import { opsPanelCard } from "@platform/ui-kit";

/**
 * A figure as the card writes it (Omar 2026-11-11): «≈» — every number here is an estimate or a
 * mean — then whole riyals with thousands separators, then «ر.س.» in smaller type; «—» when not
 * known.
 *
 * How it works: the line reads right to left like the card (sign, number, currency), and only the
 * number itself is set left to right so its separators keep their order.
 */
function Figure({ value }: { value: number | null | undefined }) {
  if (value == null) return <>—</>;
  return (
    <>
      ≈ <bdi dir="ltr">{fmt(value)}</bdi>{" "}
      <span className="text-[10px] font-medium opacity-80">ر.س.</span>
    </>
  );
}

/** What a district rate is the mean of — the row's tooltip. */
function districtRateHint(rate: DistrictLandRate | undefined, use: string, district: string): string {
  if (!district) return "لا حيّ مسجّل للعقار";
  if (!rate || rate.count === 0) return `لا أراضٍ ${use} مسجّلة في بنك المقارنات لحي ${district}`;
  return `متوسط سعر المتر لـ ${rate.count} أرض ${use} في بنك المقارنات — حي ${district}`;
}

/** One figure on the card's light part: its name in gold, its number in the heading colour. */
function Row({
  label,
  value,
  title,
}: {
  label: string;
  value: number | null | undefined;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" title={title}>
      <dt className="text-gold-d">{label}</dt>
      <dd className="m-0 whitespace-nowrap font-bold tabular-nums text-heading">
        <Figure value={value} />
      </dd>
    </div>
  );
}

/** A block of related rows; every block after the first is parted from the one above by a hairline. */
function Group({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
      {children}
    </div>
  );
}

/**
 * The figures card under «حالة الأطراف» (Omar 2026-11-11), with no title: the district's land rate
 * for residential (س) and commercial (ت) use, then the valuation's land, buildings and property
 * values as the appraiser works — for the appraiser and the case specialist.
 *
 * How it looks: a light card like the others of the rail, closed by a navy band with gold writing
 * that carries the property's value (it was navy all over at first; Omar asked the same day for
 * the light surface, the property's value kept as it was).
 * How it works: the district rates are the mean of the bank's land comparables in the property's
 * district; the valuation figures are what the appraiser saved so far, read again every half
 * minute and at once after each save on the appraiser's own page.
 * Edge cases: a figure not known yet shows «—» — nothing valued yet, an approach not used, no
 * land comparable of that use in the district, or the valuation request closed after the final
 * report. The card shows while it loads, with «—» in every row, so the column does not jump.
 */
export function PropertyValuationFiguresCard({
  propertyId,
  district,
  city,
}: {
  propertyId: string;
  district?: string | null;
  city?: string | null;
}) {
  const place = district?.trim() ?? "";
  const { data: rates } = useDistrictLandRatesQuery({ district: place, city });
  const { data: figures } = usePropertyValuationFiguresQuery(propertyId);
  return (
    <section
      aria-label="أسعار المنطقة وقيم التقييم"
      data-testid="rail-valuation-figures"
      className={`${opsPanelCard} overflow-hidden text-[12px]`}
    >
      <dl className="m-0">
        <div className="flex flex-col gap-2.5 px-3 py-3">
          <Group>
            <Row
              label="سعر المنطقة (س):"
              value={rates?.residential.rate}
              title={districtRateHint(rates?.residential, "سكنية", place)}
            />
            <Row
              label="سعر المنطقة (ت):"
              value={rates?.commercial.rate}
              title={districtRateHint(rates?.commercial, "تجارية", place)}
            />
          </Group>
          <Group>
            <Row label="سعر متر الأرض:" value={figures?.landRate} />
            <Row label="قيمة الأرض:" value={figures?.landValue} />
          </Group>
          <Group>
            <Row label="سعر متر المباني:" value={figures?.buildingRate} />
            <Row label="قيمة المباني:" value={figures?.buildingsValue} />
          </Group>
        </div>
        {/* The property's value keeps the card's first look: gold on navy. */}
        <div className="flex items-baseline justify-between gap-2 bg-ink px-3 py-2.5 text-[color:var(--gold-2)]">
          <dt className="font-bold">قيمة العقار:</dt>
          <dd className="m-0 whitespace-nowrap text-[15px] font-extrabold tabular-nums">
            <Figure value={figures?.propertyValue} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
