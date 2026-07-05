/** Open generated HTML in a new tab (works with popup blockers + noopener). */
export function openHtmlDocumentInNewTab(
  html: string,
  options?: { print?: boolean },
): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Open about:blank synchronously so we can detect popup blockers. Using
  // noopener in window.open() returns null even on success in modern browsers.
  const win = window.open("about:blank", "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }

  win.opener = null;
  win.location.href = url;

  win.addEventListener(
    "load",
    () => {
      URL.revokeObjectURL(url);
      win.focus();
      if (options?.print) win.print();
    },
    { once: true },
  );

  return true;
}
