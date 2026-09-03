import { getFailureTypesCatalog } from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  resolveApiError,
} from "@platform/app-shared/app-data/modules-api-config";
import type {
  FailureProblemType,
  FailureTypeCategory,
} from "./failure-types-data";
import type { FailureTypesCatalog } from "./failure-types-model";

export async function loadFailureTypesCatalog(): Promise<FailureTypesCatalog> {
  const config = requirePrototypeModulesApiConfig();
  const result = await getFailureTypesCatalog(config);
  if (!result.ok) {
    throw new Error(
      resolveApiError(result.kind, undefined, "تعذّر تحميل أنواع التعذر"),
    );
  }
  return {
    categories: result.data.categories as FailureTypeCategory[],
    problemTypes: result.data.problemTypes as FailureProblemType[],
  };
}
