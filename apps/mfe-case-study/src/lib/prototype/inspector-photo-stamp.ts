function loadImage(img: HTMLImageElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("تعذّر تحميل الصورة للختم"));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Burns a multi-line documentation strip into JPEG pixels after compression. */
export async function burnInspectorPhotoStamp(
  file: File,
  stamp: string,
): Promise<File> {
  if (!stamp.trim() || typeof document === "undefined") return file;

  const dataUrl = await readAsDataUrl(file);
  const img = new Image();
  await loadImage(img, dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0);
  const lines = stamp
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const lineCount = Math.max(1, lines.length);
  const barHeight = Math.max(28 * lineCount, Math.floor(canvas.height * 0.09));
  const y = canvas.height - barHeight;
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, y, canvas.width, barHeight);
  ctx.fillStyle = "#ffffff";
  const fontSize = Math.max(11, Math.floor(barHeight / (lineCount + 1.2)));
  ctx.font = `600 ${fontSize}px Tahoma, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const lineGap = barHeight / (lineCount + 1);
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width - 10, y + lineGap * (i + 1));
  });

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
  });
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
