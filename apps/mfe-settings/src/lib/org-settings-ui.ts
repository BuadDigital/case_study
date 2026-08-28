/** مساعدات واجهة إعدادات المنشأة — كانت منسوخة في ثلاث شاشات (الهوية/البيانات/السجل). */

export function pickImage(
  onPicked: (dataUrl: string, name: string, kb: number) => void,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/svg+xml";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPicked(reader.result, file.name, Math.round(file.size / 1024));
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export async function refreshOrgCache(): Promise<void> {
  const { clearOrganizationSettingsCache, ensureOrganizationSettingsLoaded } =
    await import(
      "@platform/app-shared/organization/organization-settings-cache"
    );
  clearOrganizationSettingsCache();
  await ensureOrganizationSettingsLoaded();
}
