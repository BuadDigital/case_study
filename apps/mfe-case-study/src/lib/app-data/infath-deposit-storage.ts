import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";

export type InfathDepositDraft = {
  depositCode: string;
  depositCertificateName: string;
};

export function loadInfathDeposit(propertyId: string): InfathDepositDraft {
  if (typeof window === "undefined" || !propertyId.trim()) {
    return { depositCode: "", depositCertificateName: "" };
  }
  const parsed = loadSpecialistReportExtrasBag(propertyId).infathDeposit ?? {};
  return {
    depositCode: String(parsed.depositCode ?? "").trim(),
    depositCertificateName: String(parsed.depositCertificateName ?? "").trim(),
  };
}

export function saveInfathDeposit(
  propertyId: string,
  draft: InfathDepositDraft,
): void {
  if (typeof window === "undefined" || !propertyId.trim()) return;
  patchSpecialistReportExtras(propertyId, {
    infathDeposit: {
      depositCode: draft.depositCode.trim(),
      depositCertificateName: draft.depositCertificateName.trim(),
    },
  });
}
