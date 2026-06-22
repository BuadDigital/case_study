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

/** Burns date/time/GPS stamp into the image pixels before upload. */
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
  const barHeight = Math.max(28, Math.floor(canvas.height * 0.07));
  const y = canvas.height - barHeight;
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, y, canvas.width, barHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.max(11, Math.floor(barHeight * 0.42))}px Tahoma, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(stamp.trim(), canvas.width - 10, y + barHeight / 2);

  const mime = file.type.startsWith("image/") ? file.type : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, 0.92);
  });
  if (!blob) return file;

  return new File([blob], file.name, { type: mime, lastModified: Date.now() });
}
