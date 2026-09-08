/** PO intake — property boundary field keys and empty factory. */

export const PROPERTY_BOUNDARY_ROWS = [
  {
    descKey: "northBoundary",
    lenKey: "northBoundaryLengthM",
    typeKey: "northBoundaryType",
    facadeKey: "northFacadeFinishing",
    label: "الحد الشمالي",
  },
  {
    descKey: "southBoundary",
    lenKey: "southBoundaryLengthM",
    typeKey: "southBoundaryType",
    facadeKey: "southFacadeFinishing",
    label: "الحد الجنوبي",
  },
  {
    descKey: "eastBoundary",
    lenKey: "eastBoundaryLengthM",
    typeKey: "eastBoundaryType",
    facadeKey: "eastFacadeFinishing",
    label: "الحد الشرقي",
  },
  {
    descKey: "westBoundary",
    lenKey: "westBoundaryLengthM",
    typeKey: "westBoundaryType",
    facadeKey: "westFacadeFinishing",
    label: "الحد الغربي",
  },
] as const;

export const PROPERTY_BOUNDARY_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "street", label: "شارع" },
  { value: "plot", label: "قطعة" },
  { value: "passage", label: "ممر" },
  { value: "rail", label: "سكة" },
] as const;

export const PROPERTY_FINISHING_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "luxury", label: "فاخر" },
  { value: "medium", label: "متوسط" },
  { value: "ordinary", label: "عادي" },
  { value: "none", label: "بدون تشطيب" },
] as const;

export const PROPERTY_FINISHING_STRUCTURE_OPTIONS = [
  { value: "", label: "—" },
  { value: "concrete", label: "خرساني" },
  { value: "metal", label: "معدني" },
  { value: "mixed", label: "مختلط" },
  { value: "other", label: "أخرى" },
] as const;

export type PropertyBoundaryDescKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["descKey"];
export type PropertyBoundaryLenKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["lenKey"];
export type PropertyBoundaryTypeKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["typeKey"];
export type PropertyBoundaryFacadeKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["facadeKey"];

export function clearPropertyBoundaryFields(): {
  northBoundary: string;
  northBoundaryLengthM: string;
  northBoundaryType: string;
  northFacadeFinishing: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  southBoundaryType: string;
  southFacadeFinishing: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  eastBoundaryType: string;
  eastFacadeFinishing: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  westBoundaryType: string;
  westFacadeFinishing: string;
} {
  return {
    northBoundary: "",
    northBoundaryLengthM: "",
    northBoundaryType: "",
    northFacadeFinishing: "",
    southBoundary: "",
    southBoundaryLengthM: "",
    southBoundaryType: "",
    southFacadeFinishing: "",
    eastBoundary: "",
    eastBoundaryLengthM: "",
    eastBoundaryType: "",
    eastFacadeFinishing: "",
    westBoundary: "",
    westBoundaryLengthM: "",
    westBoundaryType: "",
    westFacadeFinishing: "",
  };
}
