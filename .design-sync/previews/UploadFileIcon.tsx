import { UploadFileIcon } from "@platform/ui-kit";

export function Default() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", color: "var(--text-3)" }}>
      <UploadFileIcon />
      <UploadFileIcon size={28} />
    </div>
  );
}
