import { getApiBase } from "./index";

export type DevLoginUserDto = {
  username: string;
  label: string;
};

export type DevLoginUsersResult =
  | { ok: true; users: DevLoginUserDto[] }
  | { ok: false; kind: "network" | "server" | "unavailable" };

export async function fetchDevLoginUsers(
  baseUrl?: string,
): Promise<DevLoginUsersResult> {
  const base = baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/auth/dev-login-users`);
    if (res.status === 404) return { ok: false, kind: "unavailable" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as unknown[];
    const users = Array.isArray(raw)
      ? raw.map((row) => {
          const item = row as Record<string, unknown>;
          return {
            username: String(item.username ?? item.Username ?? ""),
            label: String(item.label ?? item.Label ?? ""),
          };
        })
      : [];
    return { ok: true, users: users.filter((u) => u.username) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
