"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { RegSearchSelect } from "@platform/app-shared/registration/RegSearchSelect";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  listSelectableCities,
  listSelectableDistricts,
  listSelectableRegions,
  suggestLocation,
  type LocationSimilarityDto,
  type SelectableCityDto,
  type SelectableDistrictDto,
  type SelectableRegionDto,
} from "@platform/api-client";
import {
  Badge,
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/ui-kit";
import { regionsApiConfig } from "@settings/mfe/lib/settings-api-config";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";

type Props = {
  property: Pick<
    PoPropertyIntake,
    "region" | "regionId" | "city" | "cityId" | "district" | "districtId"
  >;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
  required?: boolean;
};

type SuggestPrompt = {
  kind: "city" | "district";
  nameAr: string;
  similar: LocationSimilarityDto[];
};

function cityOptionLabel(city: SelectableCityDto, showEn: boolean): string {
  const base = city.isCapital ? `${city.nameAr} ★` : city.nameAr;
  if (showEn && city.nameEn?.trim()) {
    return `${base} (${city.nameEn.trim()})`;
  }
  return base;
}

export function RegionCitySelects({
  property,
  fieldErrors,
  onPatch,
  required = true,
}: Props) {
  const [regions, setRegions] = useState<SelectableRegionDto[]>([]);
  const [cities, setCities] = useState<SelectableCityDto[]>([]);
  const [districts, setDistricts] = useState<SelectableDistrictDto[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestPrompt, setSuggestPrompt] = useState<SuggestPrompt | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);

  const citySearchSeq = useRef(0);
  const districtSearchSeq = useRef(0);
  const cityDebounce = useRef<number | null>(null);
  const districtDebounce = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const config = regionsApiConfig();
    if (!config) {
      setRegions([]);
      setCatalogError("يجب تسجيل الدخول لتحميل المناطق والمدن");
      return;
    }

    void listSelectableRegions(config).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setRegions([]);
        setCatalogError(
          result.kind === "auth"
            ? "يجب تسجيل الدخول لتحميل المناطق والمدن"
            : "تعذّر تحميل المناطق — تحقق من تشغيل الـ API",
        );
        return;
      }
      setRegions(result.regions);
      setCatalogError(
        result.regions.length === 0
          ? "لا توجد مناطق في النظام — أعد تشغيل Platform API"
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

  const selectedCityId = property.cityId?.trim() ?? "";
  const selectedDistrictId = property.districtId?.trim() ?? "";

  const loadCities = (regionId: string, query: string) => {
    const config = regionsApiConfig();
    if (!config || !regionId) {
      setCities([]);
      return;
    }
    const seq = ++citySearchSeq.current;
    setCitiesLoading(true);
    void listSelectableCities(config, regionId, query).then((result) => {
      if (seq !== citySearchSeq.current) return;
      setCitiesLoading(false);
      if (!result.ok) {
        setCities([]);
        return;
      }
      setCities(result.cities);
    });
  };

  const loadDistricts = (cityId: string, query: string) => {
    const config = regionsApiConfig();
    if (!config || !cityId) {
      setDistricts([]);
      return;
    }
    const seq = ++districtSearchSeq.current;
    setDistrictsLoading(true);
    void listSelectableDistricts(config, cityId, query).then((result) => {
      if (seq !== districtSearchSeq.current) return;
      setDistrictsLoading(false);
      if (!result.ok) {
        setDistricts([]);
        return;
      }
      setDistricts(result.districts);
    });
  };

  useEffect(() => {
    if (!selectedRegionId) {
      setCities([]);
      return;
    }
    loadCities(selectedRegionId, "");
  }, [selectedRegionId]);

  useEffect(() => {
    if (!selectedCityId) {
      setDistricts([]);
      return;
    }
    loadDistricts(selectedCityId, "");
  }, [selectedCityId]);

  useEffect(
    () => () => {
      if (cityDebounce.current) window.clearTimeout(cityDebounce.current);
      if (districtDebounce.current) window.clearTimeout(districtDebounce.current);
    },
    [],
  );

  const nameCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cities) {
      map.set(c.nameAr, (map.get(c.nameAr) ?? 0) + 1);
    }
    return map;
  }, [cities]);

  const cityOptions = useMemo(() => {
    const options = cities.map((c) => ({
      value: c.id,
      label: cityOptionLabel(c, (nameCounts.get(c.nameAr) ?? 0) > 1),
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
  }, [cities, selectedCityId, property.city, nameCounts]);

  const districtOptions = useMemo(() => {
    const options = districts.map((d) => ({
      value: d.id,
      label: d.nameAr,
    }));
    if (
      selectedDistrictId &&
      !options.some((o) => o.value === selectedDistrictId) &&
      property.district.trim()
    ) {
      options.unshift({
        value: selectedDistrictId,
        label: property.district.trim(),
      });
    }
    return options;
  }, [districts, selectedDistrictId, property.district]);

  const regionOptions = useMemo(
    () => regions.map((r) => ({ value: r.id, label: r.nameAr })),
    [regions],
  );

  const selectedCityStatus =
    cities.find((c) => c.id === selectedCityId)?.status ?? "";
  const selectedDistrictStatus =
    districts.find((d) => d.id === selectedDistrictId)?.status ?? "";

  const applyCity = (city: SelectableCityDto) => {
    onPatch("cityId", city.id);
    onPatch("city", city.nameAr);
    onPatch("districtId", "");
    onPatch("district", "");
    if (city.regionId) {
      const region = regions.find((r) => r.id === city.regionId);
      onPatch("regionId", city.regionId);
      onPatch("region", region?.nameAr ?? city.regionNameAr ?? "");
    }
  };

  const applyDistrict = (district: SelectableDistrictDto) => {
    onPatch("districtId", district.id);
    onPatch("district", district.nameAr);
  };

  const runSuggest = async (
    kind: "city" | "district",
    nameAr: string,
    forceCreate: boolean,
  ) => {
    const config = regionsApiConfig();
    if (!config) {
      setSuggestError("يجب تسجيل الدخول لإضافة مسمّى");
      return;
    }
    if (kind === "city" && !selectedRegionId) {
      setSuggestError("اختر المنطقة أولاً");
      return;
    }
    if (kind === "district" && !selectedCityId) {
      setSuggestError("اختر المدينة أولاً");
      return;
    }

    setSuggestBusy(true);
    setSuggestError(null);
    const result = await suggestLocation(config, {
      kind,
      nameAr,
      forceCreate,
      regionId: kind === "city" ? selectedRegionId : undefined,
      cityId: kind === "district" ? selectedCityId : undefined,
    });
    setSuggestBusy(false);

    if (!result.ok) {
      setSuggestError(
        result.message ??
          (result.kind === "auth"
            ? "يجب تسجيل الدخول"
            : "تعذّر إضافة المسمّى — حاول مرة أخرى"),
      );
      setSuggestPrompt(null);
      return;
    }

    if (result.result.requiresConfirmation) {
      setSuggestPrompt({
        kind,
        nameAr,
        similar: result.result.similar,
      });
      return;
    }

    setSuggestPrompt(null);
    if (kind === "city" && result.result.city) {
      applyCity(result.result.city);
      setCities((prev) => {
        if (prev.some((c) => c.id === result.result.city!.id)) return prev;
        return [result.result.city!, ...prev];
      });
    }
    if (kind === "district" && result.result.district) {
      applyDistrict(result.result.district);
      setDistricts((prev) => {
        if (prev.some((d) => d.id === result.result.district!.id)) return prev;
        return [result.result.district!, ...prev];
      });
    }
  };

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
          onPatch("cityId", "");
          onPatch("city", "");
          onPatch("districtId", "");
          onPatch("district", "");
          setSuggestError(null);
        }}
      />
      <div>
        <RegSearchSelect
          id="city"
          label="المدينة"
          required={required}
          options={cityOptions}
          value={selectedCityId}
          error={fieldErrors.city ?? suggestError ?? undefined}
          disabled={!selectedRegionId}
          serverFiltered
          loading={citiesLoading}
          placeholder={
            selectedRegionId
              ? "ابحث عن مدينة (المحافظات أولاً)…"
              : "اختر المنطقة أولاً…"
          }
          hint="بدون بحث تظهر المحافظات فقط — اكتب لتوسيع البحث"
          createLabel={(q) => `إضافة «${q}» كمدينة مبدئية`}
          onCreate={(q) => void runSuggest("city", q, false)}
          onQueryChange={(q) => {
            if (!selectedRegionId) return;
            if (cityDebounce.current) window.clearTimeout(cityDebounce.current);
            cityDebounce.current = window.setTimeout(
              () => loadCities(selectedRegionId, q),
              220,
            );
          }}
          onChange={(value) => {
            setSuggestError(null);
            if (!value) {
              onPatch("cityId", "");
              onPatch("city", "");
              onPatch("districtId", "");
              onPatch("district", "");
              return;
            }
            const selected = cities.find((c) => c.id === value);
            if (selected) {
              applyCity(selected);
              return;
            }
            onPatch("cityId", value);
            onPatch("districtId", "");
            onPatch("district", "");
          }}
        />
        {selectedCityStatus === "pending" ? (
          <Badge tone="warning" className="mt-1">
            مسمّى مدينة مبدئي
          </Badge>
        ) : null}
      </div>
      <div>
        <RegSearchSelect
          id="district"
          label="الحي"
          required={required}
          options={districtOptions}
          value={selectedDistrictId}
          error={fieldErrors.district}
          disabled={!selectedCityId}
          serverFiltered
          loading={districtsLoading}
          placeholder={
            selectedCityId ? "ابحث عن حي أو أضف مبدئياً…" : "اختر المدينة أولاً…"
          }
          hint="قائمة الأحياء تُبنى من إدخالات المستخدمين"
          createLabel={(q) => `إضافة «${q}» كحي مبدئي`}
          onCreate={(q) => void runSuggest("district", q, false)}
          onQueryChange={(q) => {
            if (!selectedCityId) return;
            if (districtDebounce.current)
              window.clearTimeout(districtDebounce.current);
            districtDebounce.current = window.setTimeout(
              () => loadDistricts(selectedCityId, q),
              220,
            );
          }}
          onChange={(value) => {
            if (!value) {
              onPatch("districtId", "");
              onPatch("district", "");
              return;
            }
            const selected = districts.find((d) => d.id === value);
            if (selected) {
              applyDistrict(selected);
              return;
            }
            onPatch("districtId", value);
          }}
        />
        {selectedDistrictStatus === "pending" ? (
          <Badge tone="warning" className="mt-1">
            مسمّى حي مبدئي
          </Badge>
        ) : null}
      </div>

      {suggestPrompt ? (
        <ModalOverlay
          role="presentation"
          onClick={() => {
            if (!suggestBusy) setSuggestPrompt(null);
          }}
        >
          <ModalCard
            className="max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <ModalTitle>مسميات مشابهة موجودة</ModalTitle>
              <ModalClose
                aria-label="إغلاق"
                onClick={() => setSuggestPrompt(null)}
              >
                ×
              </ModalClose>
            </ModalHeader>
            <ModalBody>
              <p className="mb-3 text-xs text-text-2">
                هل تقصد أحد هذه المسميات بدل «{suggestPrompt.nameAr}»؟
              </p>
              <ul className="space-y-1.5">
                {suggestPrompt.similar.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-[var(--radius-DEFAULT)] border border-border px-3 py-2 text-start text-xs hover:bg-surface-2"
                      disabled={suggestBusy}
                      onClick={() => {
                        if (suggestPrompt.kind === "city") {
                          applyCity({
                            id: item.id,
                            regionId: selectedRegionId,
                            nameAr: item.nameAr,
                            isCapital: false,
                            status: item.status,
                          });
                          setCities((prev) => {
                            if (prev.some((c) => c.id === item.id)) return prev;
                            return [
                              {
                                id: item.id,
                                regionId: selectedRegionId,
                                nameAr: item.nameAr,
                                isCapital: false,
                                status: item.status,
                              },
                              ...prev,
                            ];
                          });
                        } else {
                          applyDistrict({
                            id: item.id,
                            cityId: selectedCityId,
                            nameAr: item.nameAr,
                            status: item.status,
                          });
                          setDistricts((prev) => {
                            if (prev.some((d) => d.id === item.id)) return prev;
                            return [
                              {
                                id: item.id,
                                cityId: selectedCityId,
                                nameAr: item.nameAr,
                                status: item.status,
                              },
                              ...prev,
                            ];
                          });
                        }
                        setSuggestPrompt(null);
                      }}
                    >
                      <span>{item.nameAr}</span>
                      <Badge tone={item.isApproved ? "success" : "warning"}>
                        {item.isApproved ? "معتمد" : "مبدئي"}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={suggestBusy}
                onClick={() => setSuggestPrompt(null)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                loading={suggestBusy}
                onClick={() =>
                  void runSuggest(
                    suggestPrompt.kind,
                    suggestPrompt.nameAr,
                    true,
                  )
                }
              >
                لا، أضف الاسم الجديد
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </>
  );
}
