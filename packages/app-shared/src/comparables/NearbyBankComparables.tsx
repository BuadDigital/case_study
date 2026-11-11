"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  suggestComparablePropertiesByProximity,
  type ComparablePropertyDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import {
  COMPARABLE_SOURCE_OPTIONS,
  comparableDealLabel,
  sourceCardLine,
} from "@platform/app-shared/app-data/comparable-entry";
import type { LatLng } from "@platform/app-shared/domain/geo";
import { ymd } from "@platform/app-shared/format/date";
import { fmt, fmtMax } from "@platform/app-shared/format/number";
import { Button, OpsReadField } from "@platform/ui-kit";
import {
  NEARBY_BANK_PIN_RADIUS_KM,
  NEARBY_BANK_SUBJECT_RADIUS_KM,
  distanceLabelAr,
  mergeNearbyBankComparables,
} from "./nearby-bank-comparables";

/** The proximity endpoint returns at most 100 rows. */
const NEARBY_BANK_TAKE = 100;

function useBankAround(center: LatLng | null, maxDistanceKm: number) {
  // ~11 m steps: nudging the pin does not refetch on every pixel.
  const latitude = center ? Number(center.lat.toFixed(4)) : null;
  const longitude = center ? Number(center.lng.toFixed(4)) : null;
  return useQuery({
    queryKey: ["comparable-bank-nearby", latitude, longitude, maxDistanceKm],
    enabled: latitude != null && longitude != null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ComparablePropertyDto[]> => {
      const config = workOrdersApiConfig();
      if (!config || latitude == null || longitude == null) return [];
      const res = await suggestComparablePropertiesByProximity(config, {
        latitude,
        longitude,
        maxDistanceKm,
        take: NEARBY_BANK_TAKE,
      });
      return res.ok ? res.data.items.map((item) => item.comparable) : [];
    },
  });
}

/**
 * The bank's comparables to draw on the entry map, so whoever enters a comparable sees the ones
 * already recorded.
 *
 * How it works: two reads of the proximity endpoint — around the subject property, and around a
 * second point (the pin being placed, or where a browsed map rests; `otherRadiusKm` around it) —
 * merged into one list.
 *
 * Edge cases: no session, no network or no location gives an empty list; the map works without it.
 * The endpoint leaves out comparables tagged anomalous, unreliable or duplicate.
 */
export function useNearbyBankComparables(
  subjectPin: LatLng | null,
  otherPoint: LatLng | null,
  otherRadiusKm: number = NEARBY_BANK_PIN_RADIUS_KM,
): ComparablePropertyDto[] {
  const aroundSubject = useBankAround(subjectPin, NEARBY_BANK_SUBJECT_RADIUS_KM).data;
  const aroundPin = useBankAround(otherPoint, otherRadiusKm).data;
  return useMemo(
    () => mergeNearbyBankComparables(aroundSubject, aroundPin),
    [aroundSubject, aroundPin],
  );
}

function sourceLabel(source: string): string {
  return COMPARABLE_SOURCE_OPTIONS.find((opt) => opt.value === source)?.label ?? source;
}

/**
 * Every detail of a comparable already in the bank, shown when its pin is pressed.
 *
 * How it works: read-only fields; the action button (`useLabel`, «استخدم هذا المقارن» by default)
 * appears only when the host can act on the comparable (`onUse`).
 */
export function ExistingComparableCard({
  comparable,
  metersFromSubject,
  onUse,
  useLabel = "استخدم هذا المقارن",
  useBusy = false,
  onClose,
}: {
  comparable: ComparablePropertyDto;
  /**
   * Distance from the subject property, when it has a location (Omar 2026-11-11: never from
   * the pin being placed — that changed with every press on the map).
   */
  metersFromSubject?: number | null;
  onUse?: () => void;
  useLabel?: string;
  /** The action is being saved. */
  useBusy?: boolean;
  onClose: () => void;
}) {
  const place = [comparable.city, comparable.district].filter(Boolean).join(" — ");
  return (
    <div
      data-testid="existing-comparable-card"
      className="mt-2.5 rounded-lg border border-border-md bg-surface-2 px-3 py-2.5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] font-extrabold text-heading">
          مقارن مسجّل في البنك{" "}
          <bdi dir="ltr" className="whitespace-nowrap text-gold-d">
            {comparable.referenceCode}
          </bdi>
        </div>
        <div className="flex gap-2">
          {onUse ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              showActionToast={false}
              loading={useBusy}
              disabled={useBusy}
              onClick={onUse}
            >
              {useLabel}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onClose}>
            إخفاء
          </Button>
        </div>
      </div>
      {/*
        Omar 2026-11-11: as many details as fit, in little space — unboxed fields in narrow columns
        (four in the entry window, six in the wider map window, two on a phone), ordered as what it
        is, its numbers, where it is, where the information came from.
      */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-x-4 gap-y-2 rounded-md border border-border bg-surface px-3 py-2.5">
        <OpsReadField dense label="نوع العقار" value={comparable.comparablePropertyType} />
        <OpsReadField dense label="الاستخدام" value={comparable.usage || undefined} />
        <OpsReadField dense label="نوع العملية" value={comparableDealLabel(comparable)} />
        <OpsReadField dense label="تاريخ العملية" value={ymd(comparable.transactionDate)} ltr />
        <OpsReadField dense label="السعر (ر.س.)" value={fmt(comparable.price)} ltr />
        <OpsReadField dense label="المساحة (م²)" value={fmtMax(comparable.areaSqm)} ltr />
        <OpsReadField dense label="سعر المتر" value={fmtMax(comparable.pricePerSqm)} ltr />
        {metersFromSubject != null ? (
          <OpsReadField dense label="البعد عن العقار" value={distanceLabelAr(metersFromSubject)} />
        ) : null}
        <OpsReadField dense label="المدينة والحي" value={place || undefined} />
        <OpsReadField dense label="رقم المخطط" value={comparable.planNumber || undefined} ltr />
        <OpsReadField dense label="القطعة" value={comparable.plotNumber || undefined} ltr />
        <OpsReadField
          dense
          label="الإحداثيات"
          value={`${comparable.latitude}, ${comparable.longitude}`}
          ltr
        />
        <OpsReadField dense label="مصدر المعلومة" value={sourceLabel(comparable.source)} />
        <OpsReadField
          dense
          label="رقم الإعلان / الصفقة"
          value={comparable.listingNumber || comparable.transactionReference || undefined}
          ltr
        />
        <OpsReadField dense label="رقم التواصل" value={comparable.advertiserPhone || undefined} ltr />
        <OpsReadField dense label="الإدخال" value={sourceCardLine(comparable) || undefined} />
      </div>
      {comparable.description ? (
        <p className="mb-0 mt-2 text-[11.5px] leading-relaxed text-text-2">
          {comparable.description}
        </p>
      ) : null}
    </div>
  );
}
