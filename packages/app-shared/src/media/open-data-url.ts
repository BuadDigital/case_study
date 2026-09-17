/**
 * Chrome and Firefox refuse to navigate a new tab straight to a `data:` URL
 * (blocked years ago to stop phishing pages pretending to be a real site) —
 * `window.open("data:image/...;base64,…", "_blank")` opens a blank or
 * instantly-closed tab with no error. Converting to a same-origin `blob:`
 * URL first (decoded synchronously, so this stays inside the click handler's
 * user-gesture window) sidesteps the restriction entirely.
 */
export function dataUrlToBlobUrl(dataUrl: string): string | null {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, isBase64, payload] = match;
  try {
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(
      new Blob([bytes], { type: mimeType || "application/octet-stream" }),
    );
  } catch {
    return null;
  }
}

/** Opens an image/file preview in a new tab — `data:` URLs go through `dataUrlToBlobUrl` first. */
export function openDataUrlInNewTab(dataUrl: string): boolean {
  const url = dataUrl.startsWith("data:")
    ? (dataUrlToBlobUrl(dataUrl) ?? dataUrl)
    : dataUrl;
  return Boolean(window.open(url, "_blank", "noopener,noreferrer"));
}
