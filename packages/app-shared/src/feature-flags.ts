/** Feature flags — enable via `NEXT_PUBLIC_FF_<NAME>=true`. */
export type FeatureFlag =
  | "liveQueuePolling"
  | "notificationCenter"
  | "auditLog"
  | "offlineBanner";

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  liveQueuePolling: true,
  notificationCenter: true,
  auditLog: true,
  offlineBanner: true,
};

function envFlag(flag: FeatureFlag): boolean | null {
  const raw =
    typeof process !== "undefined"
      ? process.env[`NEXT_PUBLIC_FF_${flag}`]?.trim().toLowerCase()
      : "";
  if (!raw) return null;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return null;
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const override = envFlag(flag);
  if (override !== null) return override;
  return DEFAULT_FLAGS[flag];
}
