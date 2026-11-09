/** Routes under work orders — PO number is URL-encoded in paths. */

/** ASCII segment — Next.js on Windows does not reliably serve Arabic path folders. */
export const PO_PROPERTY_SEGMENT = "property";

export function poListPath(): string {
  return "/po";
}

export function poHeaderEditPath(poNumber: string): string {
  return `/po/${encodeURIComponent(poNumber.trim())}/edit`;
}

export function poPropertiesPath(poNumber: string): string {
  return `/po/${encodeURIComponent(poNumber.trim())}/${PO_PROPERTY_SEGMENT}`;
}

export function poPropertyPath(poNumber: string, propertyId: string): string {
  return `${poPropertiesPath(poNumber)}/${encodeURIComponent(propertyId)}`;
}

export function poPropertyDetailPath(
  poNumber: string,
  propertyId: string,
  tab?: string,
): string {
  const base = poPropertyPath(poNumber, propertyId);
  const t = tab?.trim();
  if (!t) return base;
  return `${base}?tab=${encodeURIComponent(t)}`;
}

/** Property detail → inspection tab in entry mode (Case Study.html desktop). */
export function poPropertyInspectionInputPath(
  poNumber: string,
  propertyId: string,
): string {
  return `${poPropertyPath(poNumber, propertyId)}?tab=inspection&inspect=edit`;
}

/**
 * The transaction's work page (plan 2026-11-05) — `#work-{section}` opens and scrolls to a section.
 */
export function poPropertyWorkPath(poNumber: string, propertyId: string, section?: string): string {
  const base = `${poPropertyPath(poNumber, propertyId)}/work`;
  return section ? `${base}#work-${section}` : base;
}

/**
 * The coordinator's page of a transaction (Omar 2026-11-08): the intake (primary data, bourse,
 * distribution) and the parties' follow-up, closed by «إرسال المعاملة للدراسة» — the work page's
 * design, a page of its own. `#work-{section}` opens and scrolls to a section.
 */
export function poPropertyCoordinationPath(
  poNumber: string,
  propertyId: string,
  section?: string,
): string {
  const base = `${poPropertyPath(poNumber, propertyId)}/coordination`;
  return section ? `${base}#work-${section}` : base;
}

/**
 * The coordinator's page of a deed's task that may have no property yet (a work order of several
 * deeds arrives as empty slots). The route creates the slot's property draft first, then opens it.
 */
export function poTaskCoordinationPath(poNumber: string, taskId: string): string {
  return `/po/${encodeURIComponent(poNumber.trim())}/task/${encodeURIComponent(taskId)}/coordination`;
}

export function poPropertyEditPath(poNumber: string, propertyId: string): string {
  return `${poPropertyPath(poNumber, propertyId)}/edit`;
}

export function poPropertyFailurePath(poNumber: string, propertyId: string): string {
  return `${poPropertyPath(poNumber, propertyId)}/failure`;
}

/** Full-page workspace for the property appraiser (property valuation). */
export function propertyAppraisalWorkspacePath(taskId: string): string {
  return `/property-appraisal/${encodeURIComponent(taskId)}`;
}

export function decodePoParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
