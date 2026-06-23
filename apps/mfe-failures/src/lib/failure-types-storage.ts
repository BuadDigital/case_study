import {
  getFailureTypesCatalog,
  saveFailureTypesCatalog,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  FAILURE_PROBLEM_TYPES,
  FAILURE_TYPE_CATEGORIES,
  type FailureProblemType,
  type FailureTypeCategory,
} from "./failure-types-data";
import { notifyFailureTypesChanged } from "./failure-types-events";

export type FailureTypesCatalog = {
  categories: FailureTypeCategory[];
  problemTypes: FailureProblemType[];
};

function seedCatalog(): FailureTypesCatalog {
  return {
    categories: [...FAILURE_TYPE_CATEGORIES],
    problemTypes: [...FAILURE_PROBLEM_TYPES],
  };
}

function notifyAndReturn(catalog: FailureTypesCatalog): FailureTypesCatalog {
  notifyFailureTypesChanged();
  return catalog;
}

async function persistCatalog(catalog: FailureTypesCatalog): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) return;

  const result = await saveFailureTypesCatalog(config, catalog);
  if (!result.ok) {
    console.warn("Failed to save failure types catalog:", result.kind);
  }
}

export async function loadFailureTypesCatalog(): Promise<FailureTypesCatalog> {
  const config = prototypeModulesApiConfig();
  if (!config) return { categories: [], problemTypes: [] };

  const result = await getFailureTypesCatalog(config);
  if (!result.ok) return { categories: [], problemTypes: [] };

  return {
    categories: result.data.categories as FailureTypeCategory[],
    problemTypes: result.data.problemTypes as FailureProblemType[],
  };
}

export async function saveFailureTypesCatalogState(
  catalog: FailureTypesCatalog,
): Promise<void> {
  await persistCatalog(catalog);
  notifyFailureTypesChanged();
}

export async function resetFailureTypesCatalog(): Promise<FailureTypesCatalog> {
  const seeded = seedCatalog();
  await persistCatalog(seeded);
  return notifyAndReturn(seeded);
}

export async function addFailureProblemType(input: {
  categoryId: string;
  label: string;
  description?: string;
}): Promise<FailureTypesCatalog> {
  const catalog = await loadFailureTypesCatalog();
  const maxOrder = catalog.problemTypes.reduce(
    (n, t) => Math.max(n, t.order),
    0,
  );
  const id = `custom-${Date.now()}`;
  const next: FailureTypesCatalog = {
    ...catalog,
    problemTypes: [
      ...catalog.problemTypes,
      {
        id,
        categoryId: input.categoryId,
        label: input.label.trim(),
        description: input.description?.trim() || undefined,
        order: maxOrder + 1,
      },
    ],
  };
  await persistCatalog(next);
  return notifyAndReturn(next);
}

export async function removeFailureProblemType(
  id: string,
): Promise<FailureTypesCatalog> {
  const catalog = await loadFailureTypesCatalog();
  const next: FailureTypesCatalog = {
    ...catalog,
    problemTypes: catalog.problemTypes.filter((t) => t.id !== id),
  };
  await persistCatalog(next);
  return notifyAndReturn(next);
}
