/** Open generated HTML in a new tab (works with popup blockers + noopener). */
export function openHtmlDocumentInNewTab(
  html: string,
  options?: { print?: boolean },
): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }

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
