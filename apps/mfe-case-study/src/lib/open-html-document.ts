/** Open generated HTML in a new tab (works with popup blockers + noopener). */
export function openHtmlDocumentInNewTab(
  html: string,
  options?: { print?: boolean; waitForImages?: boolean; waitForFonts?: boolean },
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
      const finish = () => {
        URL.revokeObjectURL(url);
        win.focus();
        if (options?.print) win.print();
      };

      const waitFonts = async () => {
        if (!options?.waitForFonts) return;
        try {
          const fonts = win.document.fonts;
          if (fonts?.ready) {
            await Promise.race([
              fonts.ready,
              new Promise<void>((resolve) => setTimeout(resolve, 2500)),
            ]);
          }
        } catch {
          // ignore — print with fallback fonts if loading fails
        }
      };

      const waitImages = () =>
        new Promise<void>((resolve) => {
          if (!options?.waitForImages) {
            resolve();
            return;
          }
          const images = Array.from(win.document.images ?? []);
          if (images.length === 0) {
            resolve();
            return;
          }
          let remaining = images.length;
          const done = () => {
            remaining -= 1;
            if (remaining <= 0) resolve();
          };
          for (const img of images) {
            if (img.complete) {
              done();
              continue;
            }
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }
        });

      void (async () => {
        await Promise.all([waitFonts(), waitImages()]);
        finish();
      })();
    },
    { once: true },
  );

  return true;
}
