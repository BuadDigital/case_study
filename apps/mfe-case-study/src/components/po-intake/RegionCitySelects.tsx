"use client";

import { useEffect, useMemo, useState } from "react";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { RegSearchSelect } from "@platform/app-shared/registration/RegSearchSelect";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  listAllSelectableCities,
  listSelectableRegions,
  type SelectableCityDto,
  type SelectableRegionDto,
} from "@platform/api-client";
import { regionsApiConfig } from "@settings/mfe/lib/settings-api-config";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";

type Props = {
  property: Pick<
    PoPropertyIntake,
    "region" | "regionId" | "city" | "cityId"
  >;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
  required?: boolean;
};

function cityOptionLabel(city: SelectableCityDto, showRegion: boolean): string {
  const base = city.isCapital ? `${city.nameAr} ★` : city.nameAr;
  if (!showRegion || !city.regionNameAr?.trim()) return base;
  return `${base} — ${city.regionNameAr.trim()}`;
}

export function RegionCitySelects({
  property,
  fieldErrors,
  onPatch,
  required = true,
}: Props) {
  const [regions, setRegions] = useState<SelectableRegionDto[]>([]);
  const [allCities, setAllCities] = useState<SelectableCityDto[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const config = regionsApiConfig();
    if (!config) {
      setRegions([]);
      setAllCities([]);
      setCatalogError("يجب تسجيل الدخول لتحميل المناطق والمدن");
      return;
    }

    void Promise.all([
      listSelectableRegions(config),
      listAllSelectableCities(config),
    ]).then(([regionsResult, citiesResult]) => {
      if (cancelled) return;

      if (!regionsResult.ok || !citiesResult.ok) {
        const kind = !regionsResult.ok
          ? regionsResult.kind
          : citiesResult.kind;
        setRegions([]);
        setAllCities([]);
        setCatalogError(
          kind === "auth"
            ? "يجب تسجيل الدخول لتحميل المناطق والمدن"
            : "تعذّر تحميل المناطق والمدن — تحقق من تشغيل الـ API",
        );
        return;
      }

      setRegions(regionsResult.regions);
      setAllCities(citiesResult.cities);
      setCatalogError(
        regionsResult.regions.length === 0 || citiesResult.cities.length === 0
          ? "لا توجد مناطق/مدن في النظام — أعد تشغيل Platform API"
          : null,
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRegionId = useMemo(() => {
    if (property.regionId?.trim()) return property.regionId.trim();
    const byName = regions.find((r) => r.nameAr === property.region?.trim());
    return byName?.id ?? "";
  }, [property.regionId, property.region, regions]);

  const citiesForSelect = useMemo(() => {
    if (!selectedRegionId) return allCities;
    return allCities.filter((c) => c.regionId === selectedRegionId);
  }, [allCities, selectedRegionId]);

  const selectedCityId = useMemo(() => {
    if (property.cityId?.trim()) return property.cityId.trim();
    const byName = allCities.find((c) => c.nameAr === property.city.trim());
    return byName?.id ?? "";
  }, [property.cityId, property.city, allCities]);

  const regionOptions = useMemo(
    () =>
      regions.map((r) => ({
        value: r.id,
        label: r.nameAr,
      })),
    [regions],
  );

  const cityOptions = useMemo(() => {
    const showRegion = !selectedRegionId;
    const options = citiesForSelect.map((c) => ({
      value: c.id,
      label: cityOptionLabel(c, showRegion),
    }));
    if (
      selectedCityId &&
      !options.some((o) => o.value === selectedCityId) &&
      property.city.trim()
    ) {
      options.unshift({
        value: selectedCityId,
        label: property.city.trim(),
      });
    }
    return options;
  }, [citiesForSelect, selectedCityId, property.city, selectedRegionId]);

  return (
    <>
      <RegSelect
        id="region"
        label="المنطقة"
        required={required}
        options={regionOptions}
        value={selectedRegionId}
        error={fieldErrors.region ?? catalogError ?? undefined}
        placeholder="اختر المنطقة..."
        onChange={(value) => {
          const selected = regions.find((r) => r.id === value);
          onPatch("regionId", value || "");
          onPatch("region", selected?.nameAr ?? "");
          if (!value) return;
          const cityStillValid =
            selectedCityId &&
            allCities.some(
              (c) => c.id === selectedCityId && c.regionId === value,
            );
          if (!cityStillValid) {
            onPatch("cityId", "");
            onPatch("city", "");
          }
        }}
      />
      <RegSearchSelect
        id="city"
        label="المدينة"
        required={required}
        options={cityOptions}
        value={selectedCityId}
        error={fieldErrors.city}
        placeholder={
          selectedRegionId
            ? "ابحث عن مدينة في المنطقة…"
            : "ابحث عن مدينة (تُعبَّأ المنطقة تلقائياً)…"
        }
        hint={
          selectedRegionId
            ? undefined
            : "اختيار المدينة يحدّد المنطقة تلقائياً"
        }
        onChange={(value) => {
          if (!value) {
            onPatch("cityId", "");
            onPatch("city", "");
            return;
          }
          const selected =
            allCities.find((c) => c.id === value) ??
            citiesForSelect.find((c) => c.id === value);
          onPatch("cityId", value);
          onPatch("city", selected?.nameAr ?? "");
          if (selected?.regionId) {
            const region = regions.find((r) => r.id === selected.regionId);
            onPatch("regionId", selected.regionId);
            onPatch(
              "region",
              region?.nameAr ?? selected.regionNameAr ?? "",
            );
          }
        }}
      />
    </>
  );
}
