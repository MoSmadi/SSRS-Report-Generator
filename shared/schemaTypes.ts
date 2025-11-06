// Schema Review Types

export type SemanticRole = "measure" | "dimension" | "time";
export type AggregationType = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "NONE";
export type DataFormat = "currency" | "number" | "percentage" | "date" | "datetime" | "text";

export interface FieldSample {
  value: string;
  count?: number;
}

export interface ValidationBadge {
  type: "warning" | "info" | "error";
  message: string;
  metric?: string; // e.g., "85% null" or "High cardinality: 10k+"
}

export interface SchemaField {
  // Identity
  technicalName: string; // Original column name from DB
  displayName: string; // User-editable friendly name
  source: string; // e.g., "dbo.Orders.TotalAmount"
  
  // Configuration
  included: boolean; // Whether field is included in report
  description: string; // User-editable description
  semanticRole: SemanticRole;
  dataType: string; // SQL type: varchar, int, decimal, datetime, etc.
  dataFormat: DataFormat;
  
  // For measures
  aggregation: AggregationType;
  
  // Metadata
  samples: FieldSample[]; // Top 5 sample values
  nullPercentage: number; // 0-100
  cardinality?: number; // Distinct value count
  validationBadges: ValidationBadge[];
  
  // Detection metadata
  isDetected: boolean; // Whether role was auto-detected
  detectionConfidence?: number; // 0-1
}

export interface ReportParameter {
  name: string;
  technicalName: string;
  type: "string" | "number" | "date" | "boolean";
  defaultValue: string | number | boolean | null;
  promptText: string;
  allowMultiple: boolean;
  isRange: boolean; // For date/number ranges
  rangeStart?: string | number;
  rangeEnd?: string | number;
  options?: string[]; // For dropdown parameters
}

export interface ChartConfiguration {
  type: "column" | "line" | "bar" | "area" | "pie";
  xAxis: string | null; // Field technical name for category axis
  series: string | null; // Field technical name for series grouping
  values: string[]; // Array of measure field technical names
  sortBy: "category" | "value";
  sortDirection: "asc" | "desc";
  showDataLabels: boolean;
  showLegend: boolean;
  title?: string;
}

export interface DataPreviewRow {
  [key: string]: string | number | boolean | null;
}

export interface DataPreview {
  rows: DataPreviewRow[];
  totalRows: number;
  page: number;
  pageSize: number;
}

export interface SchemaReview {
  fields: SchemaField[];
  parameters: ReportParameter[];
  chartConfig: ChartConfiguration;
  dataPreview: DataPreview | null;
}
