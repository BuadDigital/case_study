/** Best-effort push unsubscribe before clearing auth. Safe if push is unavailable. */
export async function unsubscribeFromPushSafe(): Promise<void> {
  try {
    const mod = await import("@/lib/web-push-client");
    await mod.unsubscribeAndUnregisterPush();
  } catch {
    /* push optional */
  }
}
