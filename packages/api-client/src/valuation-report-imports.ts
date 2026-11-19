import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { readCommand } from "./transactions";
import type { ApiErr, ApiOk } from "./work-orders";
import { ApiErrorKinds } from "./api-error-kinds";

/**
 * Valuation reports imported from an external valuation program (مقياس first) — the import
 * screen and the map's «تقارير التقييم» layer. The file goes up as base64 JSON like every other
 * upload; the server reads the sheet, so preview and commit send the same body.
 */

export type ValuationReportsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type ValuationReportSourceDto = {
  key: string;
  labelAr: string;
  /** How many columns the source's export template must have. */
  columnCount: number;
};

export type ValuationReportImportRequest = {
  source: string;
  fileName: string;
  contentBase64: string;
};

export type ValuationReportRejectedRowDto = {
  reportNumber: string;
  propertyType?: string | null;
  approvedAt?: string | null;
  reasonAr: string;
};

export type ValuationReportNumberGapDto = {
  from: string;
  to: string;
  count: number;
};

export type ValuationReportImportPreviewDto = {
  source: string;
  fileName: string;
  totalRows: number;
  firstApprovedAt?: string | null;
  lastApprovedAt?: string | null;
  /** Template columns found / required. A missing required column stops the import. */
  matchedColumns: number;
  requiredColumns: number;
  missingColumns: string[];
  newCount: number;
  replacedCount: number;
  rejectedCount: number;
  noValueCount: number;
  rejected: ValuationReportRejectedRowDto[];
  /** Gap between the source's previous upload and this file; null on a first import or when continuous. */
  previousBatchGap?: {
    lastNumber: string;
    lastImportedAtUtc: string;
    firstNumber: string;
    missingCount: number;
  } | null;
  hasPreviousBatch: boolean;
  /** Numbers missing inside the file itself — for information, never blocking. */
  internalMissingCount: number;
  internalGapCount: number;
  largestInternalGaps: ValuationReportNumberGapDto[];
};

export type ValuationReportImportBatchDto = {
  id: string;
  source: string;
  sourceLabelAr: string;
  fileName: string;
  importedByName?: string | null;
  importedAtUtc: string;
  newCount: number;
  replacedCount: number;
  rejectedCount: number;
};

/** One map point — kept small: the layer can hold hundreds of thousands. */
export type ValuationReportMapPointDto = {
  source: string;
  reportNumber: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  usage: string;
  valuationDate?: string | null;
};

export type ValuationReportDetailDto = {
  source: string;
  sourceLabelAr: string;
  reportNumber: string;
  template?: string | null;
  approver?: string | null;
  approvedAt?: string | null;
  client?: string | null;
  deedNumber?: string | null;
  propertyType: string;
  inspector?: string | null;
  usage: string;
  landArea?: number | null;
  finalValue?: number | null;
  inspectionAuditor?: string | null;
  valuationDate?: string | null;
};

type Result<T> = ApiOk<T> | ApiErr;

const ROOT = "/api/valuation-report-imports";

async function read<T>(
  config: ValuationReportsApiConfig,
  path: string,
): Promise<Result<T>> {
  try {
    const res = await fetch(`${config.baseUrl ?? getApiBase()}${ROOT}${path}`, {
      headers: authHeaders(config.token, { accept: true }),
    });
    return await readCommand<T>(res);
  } catch {
    return { ok: false, kind: ApiErrorKinds.Network };
  }
}

async function send<T>(
  config: ValuationReportsApiConfig,
  path: string,
  body: ValuationReportImportRequest,
): Promise<Result<T>> {
  try {
    const res = await fetch(`${config.baseUrl ?? getApiBase()}${ROOT}${path}`, {
      method: "POST",
      headers: authHeaders(config.token, { accept: true }),
      body: JSON.stringify(body),
    });
    return await readCommand<T>(res);
  } catch {
    return { ok: false, kind: ApiErrorKinds.Network };
  }
}

export function listValuationReportSources(config: ValuationReportsApiConfig) {
  return read<ValuationReportSourceDto[]>(config, "/sources");
}

export function previewValuationReportImport(
  config: ValuationReportsApiConfig,
  body: ValuationReportImportRequest,
) {
  return send<ValuationReportImportPreviewDto>(config, "/preview", body);
}

export function commitValuationReportImport(
  config: ValuationReportsApiConfig,
  body: ValuationReportImportRequest,
) {
  return send<ValuationReportImportBatchDto>(config, "", body);
}

export function listValuationReportImportBatches(config: ValuationReportsApiConfig) {
  return read<ValuationReportImportBatchDto[]>(config, "/batches");
}

export function listValuationReportMapPoints(config: ValuationReportsApiConfig) {
  return read<ValuationReportMapPointDto[]>(config, "/map-points");
}

export function getValuationReport(
  config: ValuationReportsApiConfig,
  source: string,
  reportNumber: string,
) {
  return read<ValuationReportDetailDto>(
    config,
    `/${encodeURIComponent(source)}/${encodeURIComponent(reportNumber)}`,
  );
}
