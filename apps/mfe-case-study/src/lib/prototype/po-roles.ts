import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

export function canReceivePo(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "case-specialist"
  );
}

export function canEditPoHeader(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function canEditProperty(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist";
}

export function isCaseStudySpecialist(role: RoleId): boolean {
  return role === "case-specialist";
}

/** عرض تفاصيل عبر زر العين — ليس لأخصائي دراسة الحالة (يفتح من الصف أو التعديل). */
export function canViewPoEye(role: RoleId): boolean {
  return isSuperAdmin(role) || !isCaseStudySpecialist(role);
}

export function isPoViewOnly(role: RoleId): boolean {
  return !isSuperAdmin(role) && role === "general-manager";
}

export function canDeletePo(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function canDeleteProperty(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/** §5 — المشرف والأخصائي يمكنهم رفع تعذر من شاشة العقار. */
export function canRaisePropertyFailure(role: RoleId): boolean {
  return canEditProperty(role) || canEditPoHeader(role);
}
