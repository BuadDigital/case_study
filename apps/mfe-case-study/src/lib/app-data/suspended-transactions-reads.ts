import { listSuspendedTransactions } from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/modules-api-config";
import {
  cacheSuspendedTransactions,
  mapSuspendedTransactionDto,
  type SuspendedTransaction,
} from "./suspended-transactions-model";

/**
 * Suspension is written through the failures API (`suspend-property-transaction`),
 * so this facade has a read side and a cache only — there is no `-commands` half.
 */
export async function loadSuspendedTransactions(): Promise<
  SuspendedTransaction[]
> {
  const config = requirePrototypeModulesApiConfig();
  const result = await listSuspendedTransactions(config);
  return cacheSuspendedTransactions(
    unwrapApiResult(result, "تعذّر تحميل المعاملات المعلّقة").map(
      mapSuspendedTransactionDto,
    ),
  );
}
