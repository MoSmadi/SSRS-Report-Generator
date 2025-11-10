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

export interface MappingEntry {
  term: string;
  role: "metric" | "dimension";
  column?: string | null;
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

      // Filter to only include databases starting with "dev" (case-insensitive)
      const devDatabases = names.filter((db: string) =>
        db.toLowerCase().startsWith("dev")
      );
      console.log("[Router] Filtered dev databases (total:", devDatabases.length, "):", devDatabases);

      // Sort to ensure "devtang" appears first, then rest alphabetically
      devDatabases.sort((a: string, b: string) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        if (aLower === "devtang") return -1;
        if (bLower === "devtang") return 1;
        return a.localeCompare(b);
      });

    if (devDatabases.length === 0) {
      console.warn("[FE] No databases returned by backend;", "raw:", body);
    } else {
      console.info("[FE] Databases fetched:", devDatabases);
    }
    return devDatabases;
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
  mapping: MappingEntry[];
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

export interface SSRSGeneratePayload {
  sql: string;
  output_path: string;
  db_name: string;
  report_name?: string;
  data_source_name?: string;
  data_set_name?: string;
}

export interface SSRSGenerateResponse {
  status: "success" | "error";
  saved_path?: string;
  report_name?: string;
  data_source?: string;
  data_set?: string;
  fields?: Array<{ name: string; rdlType: string }>;
  parameters?: Array<{ name: string; type: string }>;
  notes?: string[];
  message?: string;
}

export async function generateSSRSReport(payload: SSRSGeneratePayload): Promise<SSRSGenerateResponse> {
  const { data } = await api.post("/report/ssrs-generate", payload);
  return data;
}
