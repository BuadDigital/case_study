import { ScreenCatalogTab } from "../components/screen-catalog/ScreenCatalogTab";

export function SystemScreenCatalogView() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden max-lg:overflow-visible">
      <ScreenCatalogTab />
    </div>
  );
}
