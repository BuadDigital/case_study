/** Server-synced capabilities for prototype helpers (set after GET /api/permissions). */
let runtimeCapabilities: readonly string[] = [];

export function setRuntimeCapabilities(capabilities: readonly string[]): void {
  runtimeCapabilities = capabilities;
}

export function getRuntimeCapabilities(): readonly string[] {
  return runtimeCapabilities;
}

export function hasRuntimeCapability(capability: string): boolean {
  return runtimeCapabilities.includes(capability);
}
