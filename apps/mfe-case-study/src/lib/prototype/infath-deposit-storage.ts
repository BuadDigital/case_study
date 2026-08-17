const STORAGE_PREFIX = "infath-deposit:";

export type InfathDepositDraft = {
  depositCode: string;
  depositCertificateName: string;
};

function storageKey(propertyId: string): string {
  return `${STORAGE_PREFIX}${propertyId}`;
}

export function loadInfathDeposit(propertyId: string): InfathDepositDraft {
  if (typeof window === "undefined" || !propertyId.trim()) {
    return { depositCode: "", depositCertificateName: "" };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw) return { depositCode: "", depositCertificateName: "" };
    const parsed = JSON.parse(raw) as Partial<InfathDepositDraft>;
    return {
      depositCode: String(parsed.depositCode ?? "").trim(),
      depositCertificateName: String(parsed.depositCertificateName ?? "").trim(),
    };
  } catch {
    return { depositCode: "", depositCertificateName: "" };
  }
}

export function saveInfathDeposit(
  propertyId: string,
  draft: InfathDepositDraft,
): void {
  if (typeof window === "undefined" || !propertyId.trim()) return;
  window.localStorage.setItem(
    storageKey(propertyId),
    JSON.stringify({
      depositCode: draft.depositCode.trim(),
      depositCertificateName: draft.depositCertificateName.trim(),
    }),
  );
}
