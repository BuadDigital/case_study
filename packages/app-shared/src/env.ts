/** Validated public environment values for the shell and MFEs. */
export type AppEnv = {
  apiBase: string;
  isDev: boolean;
};

function readApiBase(): string {
  const value =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_API_BASE?.trim()) ||
    "";
  if (value) return value.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5160`;
  }
  return "http://127.0.0.1:5160";
}

export function getAppEnv(): AppEnv {
  return {
    apiBase: readApiBase(),
    isDev: process.env.NODE_ENV !== "production",
  };
}
