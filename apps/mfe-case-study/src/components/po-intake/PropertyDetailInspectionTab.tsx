"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  InlineLoadingSkeleton,
  Label,
  cn,
  formControlClassName,
  useToast,
} from "@platform/design-system";
import { DetailBadge, EmptyState } from "./PropertyDetailFields";
import {
  PROPERTY_BOUNDARY_ROWS,
  approximatePropertyGeo,
  boundariesMarkedUnavailable,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  loadInspectorWorkspaceSnapshot,
  reopenInspectorWorkspace,
} from "../../lib/prototype/inspector-workspace-storage";
import {
  INSPECTOR_FEATURE_FIELDS,
  INSPECTOR_SERVICE_OPTIONS,
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_DEFINED_PHOTOS,
  inspectorPhotoCoverageLabel,
  inspectorWorkspaceStatusLabel,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import { partyCardStatusLabel } from "../../lib/prototype/property-detail-parties";
import { propertyInspectionWorkspacePath } from "../../lib/my-task-routes";

function SharedBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-md border border-[color-mix(in_srgb,#8b5cf6_30%,transparent)] bg-[color-mix(in_srgb,#8b5cf6_14%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[#6b46c1]">
      مشترك
    </span>
  );
}

/** Case Study.html `insField` — plain label + value (no gold FieldBox). */
function InsField({
  label,
  value,
  ltr,
  badge,
  className,
}: {
  label: string;
  value?: string;
  ltr?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  const trimmed = value?.trim() ?? "";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-text-2">{label}</span>
        {badge}
      </div>
      <div
        className={cn(
          "py-0.5 text-[13px] font-semibold text-heading",
          ltr && "[direction:ltr] [unicode-bidi:isolate] text-start",
          !trimmed && "font-normal text-text-3",
        )}
      >
        {trimmed || "—"}
      </div>
    </div>
  );
}

function InsFieldsGrid({
  min = 150,
  children,
}: {
  min?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

/** Case Study.html `insCard` — white card, title row, no heavy header strip. */
function InsCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 rounded-[12px] border border-border bg-surface px-4 py-3.5 shadow-none">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
        <span className="flex-1" />
        {badge}
      </div>
      {children}
    </section>
  );
}

function ChipRow({ items, selected }: { items: string[]; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {items.map((item) => {
        const on = selected.includes(item);
        return (
          <span
            key={item}
            className={cn(
              "inline-flex items-center gap-[5px] rounded-lg border px-[11px] py-[5px] text-[11.5px]",
              on
                ? "border-[color-mix(in_srgb,#1f6f6f_30%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
                : "border-border bg-surface-2 text-text-3",
            )}
          >
            {on ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
            {item}
          </span>
        );
      })}
    </div>
  );
}

function PhotoTile({
  label,
  filled,
}: {
  label: string;
  filled: boolean;
}) {
  return (
    <div className="relative grid h-[100px] place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
      {filled ? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-3, #8a8d96)"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 5-5 4 4 3-2 4 4" />
        </svg>
      ) : (
        <span className="text-[10.5px] text-[#d9694f]">بانتظار الرفع</span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-[rgba(16,43,78,0.72)] px-1.5 py-[3px] text-center text-[9.5px] text-white">
        {label}
      </span>
    </div>
  );
}

/**
 * Case Study.html `pdInspectionHtml` — read-only 10 cards from inspector workspace.
 */
export function PropertyDetailInspectionTab({
  property,
  inspectionTask,
  inspectionCard,
  actionHref,
}: {
  property: PoPropertyIntake;
  inspectionTask: WorkflowTask | null;
  inspectionCard: PropertyDetailPartyCard | null;
  actionHref?: string;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<InspectorWorkspaceDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    if (!inspectionTask) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = () => {
      void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((loaded) => {
        if (!cancelled) {
          setDraft(loaded);
          setLoading(false);
        }
      });
    };
    load();
    const onChange = () => load();
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onChange,
      );
    };
  }, [inspectionTask]);

  const mapGeo = useMemo(() => {
    const lat = Number(draft?.mapLatitude);
    const lng = Number(draft?.mapLongitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      return { lat, lng };
    }
    return approximatePropertyGeo(property);
  }, [draft, property]);

  const osmEmbed = mapGeo
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(mapGeo.lng - 0.006).toFixed(5)}%2C${(mapGeo.lat - 0.004).toFixed(5)}%2C${(mapGeo.lng + 0.006).toFixed(5)}%2C${(mapGeo.lat + 0.004).toFixed(5)}&layer=mapnik&marker=${mapGeo.lat}%2C${mapGeo.lng}`
    : null;

  async function handleReturnForCorrection() {
    if (!inspectionTask) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    setReturning(true);
    setReturnError(null);
    const reopened = await reopenInspectorWorkspace(inspectionTask.id, trimmed);
    setReturning(false);
    if (!reopened.ok) {
      setReturnError(reopened.error);
      return;
    }
    setDraft(reopened.data);
    setReturnOpen(false);
    setReturnNote("");
    showToast("أُعيدت مهمة المعاينة للتصحيح", "success");
    window.dispatchEvent(
      new CustomEvent(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT),
    );
  }

  if (!inspectionCard) {
    return (
      <EmptyState
        title="لم يُعيَّن معاين لهذا العقار"
        sub="سيظهر تقرير المعاينة هنا بعد التعيين من التوزيع."
      />
    );
  }

  if (loading) return <InlineLoadingSkeleton />;

  const workspaceHref =
    actionHref ??
    (inspectionTask
      ? propertyInspectionWorkspacePath(inspectionTask.id)
      : undefined);

  const showAnnexPhotos = draft?.hasAnnex === "نعم";
  const photoDefs = INSPECTOR_DEFINED_PHOTOS.filter(
    (def) => !def.annexOnly || showAnnexPhotos,
  );
  const canReturn = Boolean(inspectionTask) && draft?.status === "submitted";

  return (
    <div id="pdInspection">
      <div className="mb-3.5 flex flex-col gap-3 rounded-lg border border-border bg-surface-2 px-3.5 py-[11px] max-lg:gap-3.5 max-lg:rounded-[14px] max-lg:px-4 max-lg:py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
        <div className="text-xs leading-relaxed text-text-2 max-lg:text-[13px]">
          <strong>للاطلاع فقط</strong> — ملخص تقرير المعاين. للتعديل اضغط
          «معاينة العقار» لفتح وضع الإدخال.
          {inspectionCard.name.trim() ? (
            <span className="mt-1 block text-[11px] text-text-3 max-lg:text-[12px]">
              {inspectionCard.role}: {inspectionCard.name} ·{" "}
              {partyCardStatusLabel(inspectionCard)}
              {draft
                ? ` · ${inspectorWorkspaceStatusLabel(draft.status)}`
                : ""}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 max-lg:w-full max-lg:flex-col">
          {workspaceHref ? (
            <Link href={workspaceHref} className="max-lg:block max-lg:w-full">
              <Button
                type="button"
                size="sm"
                variant="default"
                className="max-lg:min-h-12 max-lg:w-full max-lg:rounded-[12px] max-lg:text-[14px] max-lg:font-bold"
              >
                معاينة العقار
              </Button>
            </Link>
          ) : null}
          {canReturn && !returnOpen ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:w-full max-lg:rounded-[12px] max-lg:text-[13px]"
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              إعادة للتصحيح
            </button>
          ) : null}
        </div>
      </div>

      {draft?.status === "reopened" && draft.returnNote?.trim() ? (
        <div className="mb-3 rounded-lg border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text">
          <strong>مُعاد للتصحيح</strong> — {draft.returnNote.trim()}
        </div>
      ) : null}

      {returnOpen ? (
        <div className="mb-3.5 rounded-lg border border-border bg-surface px-3.5 py-3">
          <Label htmlFor="pd-inspection-return-note" className="text-xs">
            سبب الإرجاع للتصحيح <span className="text-danger-text">*</span>
          </Label>
          <textarea
            id="pd-inspection-return-note"
            className={cn(formControlClassName, "mt-1 min-h-[72px] text-xs")}
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder="صف ما يجب تصحيحه في تقرير المعاين…"
          />
          {returnError ? (
            <p className="mt-1 mb-0 text-xs text-danger-text">{returnError}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={returning}
              onClick={() => void handleReturnForCorrection()}
            >
              تأكيد الإرجاع
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={returning}
              onClick={() => {
                setReturnOpen(false);
                setReturnError(null);
                setReturnNote("");
              }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : null}

      {!draft ? (
        <EmptyState
          title="لا توجد بيانات معاينة بعد"
          sub="يظهر التقرير التفصيلي بعد بدء المعاين بإدخال البيانات."
        />
      ) : (
        <>
          <InsCard
            title="بيانات المعاينة"
            badge={<DetailBadge tone="red">إلزامي</DetailBadge>}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-text-2">
                موقع العقار على الخريطة (GPS)
              </span>
              <SharedBadge />
              <span className="text-[10.5px] text-text-3">
                — إثبات النزول الميداني
              </span>
            </div>
            <InsFieldsGrid>
              <InsField
                label="خط العرض"
                value={draft.mapLatitude || (mapGeo ? String(mapGeo.lat) : "")}
                ltr
              />
              <InsField
                label="خط الطول"
                value={draft.mapLongitude || (mapGeo ? String(mapGeo.lng) : "")}
                ltr
              />
            </InsFieldsGrid>
            <div className="relative mt-2.5 h-[200px] overflow-hidden rounded-lg border border-border">
              {osmEmbed ? (
                <iframe
                  title="خريطة المعاينة"
                  loading="lazy"
                  className="block h-full w-full border-0"
                  src={osmEmbed}
                />
              ) : (
                <div className="grid h-full place-items-center bg-surface-2 text-[12px] text-text-3">
                  لا تتوفر إحداثيات GPS بعد
                </div>
              )}
            </div>
            <div className="mt-3">
              <InsFieldsGrid>
                <InsField
                  label="تاريخ المعاينة"
                  value={draft.inspectionDate}
                  ltr
                />
                <InsField
                  label="وقت المعاينة"
                  value={draft.inspectionTime}
                  ltr
                />
              </InsFieldsGrid>
            </div>
          </InsCard>

          <InsCard title="نموذج التحقق الميداني — خصائص العقار">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    {(["#", "الحقل", "القيمة", "صورة"] as const).map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "border border-border bg-surface-2 px-2.5 py-[7px] text-[11px] font-bold text-text-2",
                          i === 1 ? "text-start" : "text-center",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INSPECTOR_FEATURE_FIELDS.map((field, index) => {
                    const val = draft.featureValues[field.key]?.trim() || "—";
                    const hasPhoto = Boolean(
                      draft.featurePhotoAttachments[field.key]?.fileName,
                    );
                    return (
                      <tr key={field.key}>
                        <td className="border border-border px-2 py-1.5 text-center text-text-3">
                          {index + 1}
                        </td>
                        <td className="border border-border px-2.5 py-1.5">
                          {field.label}
                          {field.shared ? (
                            <span className="ms-1 inline-block align-middle">
                              <SharedBadge />
                            </span>
                          ) : null}
                        </td>
                        <td className="border border-border px-2 py-1.5 text-center font-semibold text-heading">
                          {val}
                        </td>
                        <td className="border border-border px-2 py-1.5 text-center text-text-3">
                          {hasPhoto ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] text-[#1f6f6f]">
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              مرفقة
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <InsField
                label="عمر العقار (سنوات)"
                value={draft.propertyAgeYears}
                ltr
                badge={<SharedBadge />}
              />
              <p className="mb-0 mt-1.5 text-[10.5px] text-text-3">
                عمر العقار يظهر بعد تحديد «الأصل محل التقييم» ولا ينطبق على
                الأرض.
              </p>
            </div>
          </InsCard>

          <InsCard
            title="الموقع والوصول"
            badge={<DetailBadge tone="red">إدخال ميداني</DetailBadge>}
          >
            <InsFieldsGrid>
              <InsField label="اسم الشارع" value={draft.streetName} />
              <InsField label="أقرب شارع رئيسي" value={draft.mainStreetName} />
              <InsField
                label="عرض الشارع الرئيسي (م)"
                value={draft.streetWidthM}
                ltr
              />
            </InsFieldsGrid>
            <div className="mt-3">
              <InsField
                label="طريقة الوصول للعقار"
                value={draft.accessRouteDescription}
              />
            </div>
          </InsCard>

          <InsCard
            title="مكوّنات العقار"
            badge={<DetailBadge tone="red">إدخال ميداني</DetailBadge>}
          >
            <InsFieldsGrid min={130}>
              <InsField label="عدد الغرف" value={draft.roomCount} ltr />
              <InsField label="عدد الصالات" value={draft.hallCount} ltr />
              <InsField label="عدد الشقق" value={draft.unitCount} ltr />
              <InsField label="دورات المياه" value={draft.bathroomCount} ltr />
              <InsField label="المعارض" value={draft.showroomCount} ltr />
              <InsField label="الآبار" value={draft.wellCount} ltr />
              <InsField label="الأبراج" value={draft.towerCount} ltr />
              <InsField label="هل يوجد ملحق؟" value={draft.hasAnnex} />
              <InsField
                label="ملحق علوي (عدد)"
                value={
                  draft.definedPhotos.annexup?.photos.length
                    ? String(draft.definedPhotos.annexup.photos.length)
                    : draft.hasAnnex === "نعم"
                      ? "—"
                      : ""
                }
                ltr
              />
              <InsField
                label="ملحق أرضي (عدد)"
                value={
                  draft.definedPhotos.annexdn?.photos.length
                    ? String(draft.definedPhotos.annexdn.photos.length)
                    : draft.hasAnnex === "نعم"
                      ? "—"
                      : ""
                }
                ltr
              />
            </InsFieldsGrid>
          </InsCard>

          <InsCard
            title="مساحات المباني"
            badge={<DetailBadge tone="red">إدخال ميداني</DetailBadge>}
          >
            <InsFieldsGrid min={140}>
              <InsField label="مساحة البناء (م²)" value={draft.builtArea} ltr />
              <InsField
                label="عدد أدوار المباني"
                value={draft.buildingFloors}
                ltr
              />
              <InsField
                label="إجمالي مساحة القبو (م²)"
                value={draft.basementTotal}
                ltr
              />
              <InsField
                label="إجمالي مساحة اللاحق (م²)"
                value={draft.annexTotal}
                ltr
              />
              <InsField
                label="إجمالي مساحة المباني (م²)"
                value={draft.buildingsTotal}
                ltr
              />
            </InsFieldsGrid>
          </InsCard>

          {!boundariesMarkedUnavailable(property.boundariesAvailability) ? (
            <InsCard
              title="الحدود والأطوال"
              badge={
                <DetailBadge tone="teal">
                  للمطابقة — المصدر: الأخصائي (البورصة)
                </DetailBadge>
              }
            >
              <p className="mb-2 text-[11px] text-text-3">
                دور المعاين هنا مطابقة بيانات البورصة واكتشاف الخطأ — يؤكد
                المطابقة أو يعلّق بعدم المطابقة.
              </p>
              <div className="flex flex-col">
                {PROPERTY_BOUNDARY_ROWS.map((row) => {
                  const matchKey = row.descKey.replace("Boundary", "") as
                    | "north"
                    | "south"
                    | "east"
                    | "west";
                  const match = draft.boundaryMatches[matchKey];
                  const ok = match?.matches !== false;
                  return (
                    <div
                      key={row.descKey}
                      className="grid grid-cols-[90px_1fr_70px_auto] items-start gap-2.5 border-b border-border py-2 last:border-b-0"
                    >
                      <span className="text-xs font-semibold text-text-2">
                        {row.label}
                      </span>
                      <span className="text-xs text-text">
                        {property[row.descKey].trim() || "—"}
                      </span>
                      <span className="text-xs font-semibold [direction:ltr]">
                        {property[row.lenKey].trim()
                          ? `${property[row.lenKey].trim()} م`
                          : "—"}
                      </span>
                      <div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-[5px] text-[11.5px] font-bold",
                            ok ? "text-[#1f6f6f]" : "text-[#d9694f]",
                          )}
                        >
                          {ok ? "مطابق" : "عدم تطابق"}
                        </span>
                        {!ok && match?.mismatchNote.trim() ? (
                          <div className="mt-[3px] max-w-[220px] text-[10.5px] leading-snug text-[#d9694f]">
                            {match.mismatchNote}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </InsCard>
          ) : null}

          <InsCard
            title="الخدمات والمرافق المحيطة"
            badge={<DetailBadge tone="gray">اختيار متعدد</DetailBadge>}
          >
            <div className="mb-1.5 text-[11px] font-semibold text-text-2">
              الخدمات المتوفرة
            </div>
            <div className="mb-3.5">
              <ChipRow
                items={[...INSPECTOR_SERVICE_OPTIONS]}
                selected={draft.services}
              />
            </div>
            <div className="mb-1.5 text-[11px] font-semibold text-text-2">
              المرافق المحيطة
            </div>
            <ChipRow
              items={[...INSPECTOR_AMENITY_OPTIONS]}
              selected={draft.amenities}
            />
          </InsCard>

          <InsCard
            title="الوصف والملاحظات"
            badge={<DetailBadge tone="gray">نص حر</DetailBadge>}
          >
            <InsField label="وصف العقار" value={draft.propertyDescription} />
            <div className="h-3" />
            <InsField
              label="الإيجابيات والعيوب الظاهرة على الحي"
              value={draft.districtProsCons}
            />
            <div className="h-3" />
            <InsField label="ملاحظات على الأصل" value={draft.assetNotes} />
          </InsCard>

          <InsCard
            title="صور العقار الموثّقة"
            badge={
              <DetailBadge tone="teal">
                {inspectorPhotoCoverageLabel(draft)}
              </DetailBadge>
            }
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {photoDefs.map((def) => {
                const slot = draft.definedPhotos[def.id];
                const filled = Boolean(
                  slot && !slot.none && slot.photos.length > 0,
                );
                return (
                  <PhotoTile key={def.id} label={def.name} filled={filled} />
                );
              })}
            </div>
          </InsCard>

          <InsCard
            title="ملاحظات العقار الموثّقة بالصور"
            badge={
              <DetailBadge tone="red">شرح + صورة لكل ملاحظة</DetailBadge>
            }
          >
            {draft.observations.length === 0 ? (
              <p className="m-0 text-[12px] text-text-3">
                لا توجد ملاحظات مصوّرة بعد.
              </p>
            ) : (
              <div className="grid gap-[9px]">
                {draft.observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-stretch gap-2.5 rounded-lg border border-border bg-surface-2 p-[9px]"
                  >
                    <div className="grid w-[74px] shrink-0 place-items-center rounded-md border border-border bg-surface">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-3, #8a8d96)"
                        strokeWidth="1.5"
                        aria-hidden
                      >
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="8.5" cy="9.5" r="1.5" />
                        <path d="m4 17 5-5 4 4 3-2 4 4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="rounded-full bg-[#f1ece2] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8c7857]">
                        {obs.category || "ملاحظة"}
                      </span>
                      <p className="mt-1.5 mb-0 text-xs leading-relaxed text-pretty text-text-2">
                        {obs.text}
                      </p>
                      {obs.photo?.fileName ? (
                        <p className="mb-0 mt-1 text-[10.5px] text-text-3">
                          مرفق: {obs.photo.fileName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InsCard>
        </>
      )}
    </div>
  );
}
