import {
  FAILURE_PROBLEM_TYPES,
  FAILURE_TYPE_CATEGORIES,
  type FailureProblemType,
  type FailureTypeCategory,
} from "./failure-types-data";

export type FailureTypesCatalog = {
  categories: FailureTypeCategory[];
  problemTypes: FailureProblemType[];
};

export function seedCatalog(): FailureTypesCatalog {
  return {
    categories: [...FAILURE_TYPE_CATEGORIES],
    problemTypes: [...FAILURE_PROBLEM_TYPES],
  };
}
