"use client";

/**
 * The server's difference-factor catalog, loaded once per mount: tooltip
 * definitions for the adjustments table and the “add factor” menu.
 */
import { useEffect, useState } from "react";
import {
  getDifferenceFactorCatalog,
  type DifferenceFactorDefinitionDto,
} from "@platform/api-client";
import { apiConfig } from "./lib/shell-utils";
import { buildFactorCatalog } from "./lib/shell-state";

export function useDifferenceFactorCatalog() {
  const [factorDefinitions, setFactorDefinitions] = useState<Record<string, string>>({});
  const [catalogFactorOptions, setCatalogFactorOptions] = useState<
    { factorKey: string; labelAr: string }[]
  >([]);

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    void getDifferenceFactorCatalog(config).then((res) => {
      if (!res.ok) return;
      const { definitions, addable } = buildFactorCatalog(
        res.data.factors as DifferenceFactorDefinitionDto[],
      );
      setFactorDefinitions(definitions);
      setCatalogFactorOptions(addable);
    });
  }, []);

  return { factorDefinitions, catalogFactorOptions };
}
