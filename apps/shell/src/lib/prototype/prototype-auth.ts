import { fetchPermissions } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { setRuntimeCapabilities } from "@platform/app-shared/prototype/runtime-access";

async function syncPermissionsFromApi(): Promise<void> {
  const session = getAuthSession();
  if (!session?.token) return;
  try {
    const permissions = await fetchPermissions({ token: session.token });
    setRuntimeCapabilities(permissions.capabilities);
  } catch {
    // PrototypeProvider loads permissions for navigation.
  }
}

/** Ensure permissions are synced when the app shell loads with an existing JWT. */
export async function bootstrapPrototypeAuth(): Promise<boolean> {
  const session = getAuthSession();
  if (!session?.token) return false;
  await syncPermissionsFromApi();
  return true;
}
