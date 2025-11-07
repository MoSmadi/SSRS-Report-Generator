import { api } from "./api";
import { isAxiosError } from "axios";

export type SchemaInsights = {
  coveragePercent: number;
  matchedFields: Array<{ name: string; column?: string; confidence?: number }>;
  missingFields: Array<{ name: string; suggestions: string[] }>;
};

export interface AvailableColumn {
  name: string;
  type?: string;
  role?: string;
  description?: string | null;
}

export interface SuggestedMappingEntry {
  term: string;
  column: string;
  role?: string;
}

export interface InferenceResponse {
  spec?: Record<string, unknown>;
  suggestedMapping?: SuggestedMappingEntry[];
  availableColumns?: AvailableColumn[];
  schemaInsights?: SchemaInsights;
  metrics?: string[];
  dimensions?: string[];
  filters?: Array<{ field: string; operator: string; value: string }>;
  notes?: string;
}

export interface GenerateSQLResponse {
  sql: string;
  parameters?: ParamDef[];
  columns?: ColumnDef[];
}

export interface ParamDef {
  name: string;
  type?: string;
  default?: string | number | boolean | null;
  prompt?: string;
}

export interface ColumnDef {
  name: string;
  type?: string;
  role?: string;
  description?: string | null;
}

export interface PreviewResponse {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

export async function fetchCustomerDatabases(): Promise<string[]> {
  try {
    const res = await api.get("/report/customerDatabases");
    const body = res.data;

    const list = Array.isArray(body) ? body : body?.databases ?? [];
    const names = list
      .map((x: any) => (typeof x === "string" ? x : x?.name))
      .filter(
        (n: any): n is string =>
          typeof n === "string" && n.trim().length > 0
      );

    if (names.length === 0) {
      console.warn("[FE] No databases returned by backend;", "raw:", body);
    } else {
      console.info("[FE] Databases fetched:", names);
    }
    return names;
  } catch (error) {
    if (isAxiosError(error)) {
      console.error("[FE] Failed to fetch databases:", {
        url: error.config?.url,
        method: error.config?.method,
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });
    } else {
      console.error("[FE] Failed to fetch databases: unexpected error", error);
    }
    throw error;
  }
}

export async function inferFromNaturalLanguage(payload: {
  db: string;
  title?: string;
  text: string;
}): Promise<InferenceResponse> {
  const { data } = await api.post("/report/inferFromNaturalLanguage", payload);
  return data;
}

export async function generateSQL(payload: {
  db: string;
  mapping: {
    metrics: string[];
    dimensions: string[];
    filters: Array<{ field: string; operator: string; value: string }>;
  };
  spec?: Record<string, unknown>;
}): Promise<GenerateSQLResponse> {
  const { data } = await api.post("/report/generateSQL", payload);
  return data;
}

export async function previewReport(payload: {
  db: string;
  sql: string;
  params?: Record<string, unknown>;
  limit?: number;
}): Promise<PreviewResponse> {
  const { data } = await api.post("/report/preview", payload);
  return data;
}

export interface PublishReportPayload {
  db: string;
  metadata: {
    title: string;
    folder?: string;
    sharedDataSourcePath?: string;
  };
  mapping: {
    metrics: string[];
    dimensions: string[];
    filters: Array<{ field: string; operator: string; value: string }>;
  };
  columns: ColumnDef[];
  parameters?: ParamDef[];
  filters?: Array<{ field: string; operator: string; value: string }>;
  sort?: Array<{ field: string; direction: "asc" | "desc" }>;
  chart?: Record<string, unknown>;
}

export async function publishReport(payload: PublishReportPayload) {
  const { data } = await api.post("/report/publishReport", payload);
  return data;
}
