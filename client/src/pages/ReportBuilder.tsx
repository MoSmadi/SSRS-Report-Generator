import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { SchemaReviewPanel } from "@/components/SchemaReviewPanel";
import { InferenceReviewTable } from "@/components/InferenceReviewTable";
import type { AggregationType, DataFormat, SchemaReview, SemanticRole } from "@shared/schemaTypes";
import {
  fetchCustomerDatabases,
  generateSQL as generateSQLApi,
  inferFromNaturalLanguage,
  publishReport as publishReportApi,
  previewReport,
  type AvailableColumn,
  type ColumnDef,
  type ParamDef,
  type PreviewResponse,
  type SchemaInsights,
  type SuggestedMappingEntry,
  type MappingEntry,
} from "@/lib/reportApi";
import { useLocation } from "wouter";

interface Inference {
  metrics: string[];
  dimensions: string[];
  filters: Array<{ field: string; operator: string; value: string }>;
  schemaInsights?: SchemaInsights;
  availableColumns: AvailableColumn[];
  spec?: Record<string, unknown>;
  suggestedMapping?: SuggestedMappingEntry[];
}

interface SQLResult {
  sql: string;
  metrics: string[];
  dimensions: string[];
  filters: Array<{ field: string; operator: string; value: string }>;
  parameters: ParamDef[];
  columns: ColumnDef[];
}

/** Accept {databases:[{name}|string]}, or [{name}|string], or string[] → normalize to string[] */
function normalizeDbList(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : (raw as any)?.databases ?? [];
  const names = (Array.isArray(list) ? list : [])
    .map((x: any) => (typeof x === "string" ? x : x?.name))
    .filter((n: any): n is string => typeof n === "string" && n.trim().length > 0);
  return Array.from(new Set(names)); // dedupe just in case
}

function formatQueryError(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function coerceStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }
  return [];
}

function buildMappingEntries(
  metrics: string[],
  dimensions: string[],
  suggested?: SuggestedMappingEntry[]
): MappingEntry[] {
  const suggestionMap = new Map<string, string | null>();
  suggested?.forEach(entry => {
    if (!entry.term) return;
    suggestionMap.set(entry.term.toLowerCase(), entry.column ?? null);
  });

  const buildEntry = (term: string, role: MappingEntry["role"]): MappingEntry => ({
    term,
    role,
    column: suggestionMap.get(term.toLowerCase()) ?? null,
  });

  return [
    ...metrics.map(term => buildEntry(term, "metric")),
    ...dimensions.map(term => buildEntry(term, "dimension")),
  ];
}

function buildSchemaReviewModel(
  columns: ColumnDef[] = [],
  parameters: ParamDef[] = [],
  preview?: PreviewResponse | null
): SchemaReview {
  const fields = columns.map(column => {
    const resolvedRole: SemanticRole =
      column.role === "measure" || column.role === "dimension" || column.role === "time"
        ? column.role
        : column.role === "date" || column.type?.toLowerCase().includes("date")
          ? "time"
          : column.role === "metric"
            ? "measure"
            : "dimension";

    const isMeasure = resolvedRole === "measure";
    const isTime = resolvedRole === "time";
    const dataFormat: DataFormat = isMeasure ? "number" : isTime ? "date" : "text";
    const aggregation: AggregationType = isMeasure ? "SUM" : "NONE";

    return {
      technicalName: column.name,
      displayName: column.name,
      source: column.name,
      included: true,
      description: column.description ?? "",
      semanticRole: resolvedRole,
      dataType: column.type ?? (isMeasure ? "decimal" : isTime ? "datetime" : "nvarchar"),
      dataFormat,
      aggregation,
      samples: [],
      nullPercentage: 0,
      cardinality: undefined,
      validationBadges: [],
      isDetected: true,
      detectionConfidence: undefined,
    };
  });

  const mappedParameters = parameters.map(param => ({
    name: param.name,
    technicalName: param.name,
    type: (param.type as any) ?? "string",
    defaultValue: param.default ?? null,
    promptText: param.prompt ?? param.name,
    allowMultiple: false,
    isRange: false,
    options: undefined,
  }));

  const measures = fields.filter(field => field.semanticRole === "measure").map(field => field.technicalName);
  const firstDimension = fields.find(field => field.semanticRole !== "measure");

  return {
    fields,
    parameters: mappedParameters,
    chartConfig: {
      type: measures.length > 1 ? "column" : "bar",
      xAxis: firstDimension?.technicalName ?? null,
      series: null,
      values: measures,
      sortBy: "category",
      sortDirection: "asc",
      showDataLabels: false,
      showLegend: true,
      title: undefined,
    },
    dataPreview: preview
      ? {
          rows: preview.rows as any,
          totalRows: preview.rowCount,
          page: 1,
          pageSize: Math.max(preview.rows.length, 1),
        }
      : null,
  };
}

export default function ReportBuilder() {
  const [, navigate] = useLocation();
  // Form state
  const [reportTitle, setReportTitle] = useState("");
  const [naturalLanguageRequest, setNaturalLanguageRequest] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);

  // Inference and generation state
  const [inference, setInference] = useState<Inference | null>(null);
  const [sqlResult, setSqlResult] = useState<SQLResult | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<AvailableColumn[]>([]);
  const [publishedLink, setPublishedLink] = useState<string | null>(null);
  const [schemaReview, setSchemaReview] = useState<SchemaReview | null>(null);
  const [showSchemaReview, setShowSchemaReview] = useState(false);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [editedFields, setEditedFields] = useState<Array<{name: string; type: "metric" | "dimension"; description: string; source?: string}>>([]);

  const hasSchemaGaps = Boolean(
    inference && inference.schemaInsights && inference.schemaInsights.missingFields.length > 0
  );

  // Loading states
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // API calls
  const customerDatabasesQuery = useQuery({
    queryKey: ["customerDatabases"],
    queryFn: fetchCustomerDatabases,
  });

  const inferMutation = useMutation({ mutationFn: inferFromNaturalLanguage });
  const generateSQLMutation = useMutation({ mutationFn: generateSQLApi });
  const publishMutation = useMutation({ mutationFn: publishReportApi });
  const previewMutation = useMutation({ mutationFn: previewReport });

  // 🔧 Normalize DBs no matter what shape the backend returns
  const customerDatabases = useMemo(() => {
    const normalized = normalizeDbList(customerDatabasesQuery.data as any);
    if (customerDatabasesQuery.isSuccess) {
      if (normalized.length === 0) {
        console.warn("[FE] No databases returned. Raw payload:", customerDatabasesQuery.data);
      } else {
        console.info("[FE] Databases fetched:", normalized);
      }
    }
    return normalized;
  }, [customerDatabasesQuery.data, customerDatabasesQuery.isSuccess]);

  useEffect(() => {
    if (customerDatabasesQuery.isError) {
      console.error("[FE] customerDatabasesQuery error:", customerDatabasesQuery.error);
    }
  }, [customerDatabasesQuery.isError, customerDatabasesQuery.error]);

  const customerDatabasesErrorMessage = customerDatabasesQuery.isError
    ? formatQueryError(customerDatabasesQuery.error)
    : null;

  // Handle inference
  const handleInference = async () => {
    if (!selectedDatabase) {
      toast.error("Please select a customer database before analyzing");
      return;
    }
    if (!naturalLanguageRequest.trim()) {
      toast.error("Please enter a natural language request");
      return;
    }
    setInferenceLoading(true);
    try {
      const response = await inferMutation.mutateAsync({
        db: selectedDatabase,
        title: reportTitle,
        text: naturalLanguageRequest,
      });

      const spec = (response.spec ?? {}) as Record<string, unknown>;
      const specMetrics = spec["metrics"] ?? spec["metric"];
      const specDimensions = spec["dimensions"] ?? spec["dims"];
      const metrics =
        response.metrics && response.metrics.length > 0
          ? response.metrics
          : coerceStringArray(specMetrics);
      const dimensions =
        response.dimensions && response.dimensions.length > 0
          ? response.dimensions
          : coerceStringArray(specDimensions);
      const filters = Array.isArray(response.filters) ? response.filters : [];
      const availableColumns = response.availableColumns ?? [];

      setInference({
        metrics,
        dimensions,
        filters,
        schemaInsights: response.schemaInsights,
        availableColumns,
        spec: response.spec,
        suggestedMapping: response.suggestedMapping,
      });
      setFieldMetadata(availableColumns);
      setSqlResult(null);
      setSchemaReview(null);
      setShowSchemaReview(false);
      setPublishedLink(null);
      setEditedFields([]);
      toast.success("Inference completed");
      setShowFieldEditor(false);
      if (response?.schemaInsights?.missingFields?.length) {
        toast.warning(
          `Some fields were not found in ${selectedDatabase}. Review suggestions below before generating SQL.`
        );
      }
    } catch (error) {
      toast.error("Failed to infer metrics and dimensions");
      console.error(error);
    } finally {
      setInferenceLoading(false);
    }
  };

  // Handle SQL generation
  const handleGenerateSQL = async () => {
    if (!selectedDatabase) {
      toast.error("Please select a customer database");
      return;
    }
    if (!inference) {
      toast.error("Please complete inference first");
      return;
    }
    if (hasSchemaGaps) {
      const missingList = inference.schemaInsights?.missingFields.map(m => m.name).slice(0, 3).join(", ");
      toast.error(
        missingList
          ? `These fields were not found in ${selectedDatabase}: ${missingList}. Update the request or pick from the suggested columns before generating SQL.`
          : `Some requested fields were not found in ${selectedDatabase}. Please adjust the request before generating SQL.`
      );
      return;
    }

    setSqlLoading(true);
    try {
      const mappingEntries = buildMappingEntries(
        inference.metrics,
        inference.dimensions,
        inference.suggestedMapping
      );

      const specPayload = {
        ...(inference.spec ?? {}),
        metrics: inference.metrics,
        dimensions: inference.dimensions,
        filters: inference.filters,
      };

      const result = await generateSQLMutation.mutateAsync({
        db: selectedDatabase,
        mapping: mappingEntries,
        spec: specPayload,
      });

      const normalizedColumns = result.columns ?? [];
      const normalizedParams = result.parameters ?? [];

      setSqlResult({
        sql: result.sql,
        metrics: inference.metrics,
        dimensions: inference.dimensions,
        filters: inference.filters,
        parameters: normalizedParams,
        columns: normalizedColumns,
      });

      let previewData: PreviewResponse | null = null;
      try {
        previewData = await previewMutation.mutateAsync({
          db: selectedDatabase,
          sql: result.sql,
          params: {},
          limit: 100,
        });
      } catch (previewError) {
        console.warn("[FE] Failed to load preview data:", previewError);
      }

      setSchemaReview(buildSchemaReviewModel(normalizedColumns, normalizedParams, previewData));
      toast.success("SQL generated successfully");
    } catch (error) {
      toast.error("Failed to generate SQL");
      console.error(error);
    } finally {
      setSqlLoading(false);
    }
  };

  const openFieldEditor = () => {
    if (!inference) return;
    const seeded =
      editedFields.length > 0
        ? editedFields
        : [
            ...inference.metrics.map(name => ({ name, type: "metric" as const, description: "" })),
            ...inference.dimensions.map(name => ({ name, type: "dimension" as const, description: "" })),
          ];
    setEditedFields(seeded);
    setShowFieldEditor(true);
  };

  // Handle publish
  const handlePublish = async () => {
    if (!reportTitle.trim()) {
      toast.error("Please enter a report title");
      return;
    }
    if (!selectedDatabase) {
      toast.error("Please select a customer database");
      return;
    }
    if (!sqlResult) {
      toast.error("Please generate SQL first");
      return;
    }
    if (!inference) {
      toast.error("Please complete inference first");
      return;
    }

    setPublishLoading(true);
    try {
      const chartPayload = schemaReview?.chartConfig
        ? {
            type: schemaReview.chartConfig.type,
            xAxis: schemaReview.chartConfig.xAxis,
            series: schemaReview.chartConfig.series,
            values: schemaReview.chartConfig.values,
            sortBy: schemaReview.chartConfig.sortBy,
            sortDirection: schemaReview.chartConfig.sortDirection,
            showDataLabels: schemaReview.chartConfig.showDataLabels,
            showLegend: schemaReview.chartConfig.showLegend,
            title: schemaReview.chartConfig.title,
          }
        : undefined;

      const publishPayload = {
        db: selectedDatabase,
        metadata: {
          title: reportTitle,
        },
        mapping: {
          metrics: inference.metrics,
          dimensions: inference.dimensions,
          filters: inference.filters,
        },
        columns: (schemaReview?.fields ?? []).map(field => ({
          name: field.technicalName,
          type: field.dataType,
          role: field.semanticRole,
          description: field.description,
        })),
        parameters: sqlResult.parameters,
        filters: inference.filters,
        chart: chartPayload,
      };

      const response = await publishMutation.mutateAsync(publishPayload);

      if (response?.success && response?.renderLink) {
        setPublishedLink(response.renderLink);
        toast.success("Report published successfully!");
      } else if (response?.renderLink) {
        setPublishedLink(response.renderLink);
        toast.success("Report published (render link ready).");
      } else if (response?.error) {
        toast.error(response.error.message ?? "Publish failed");
      } else {
        toast.error("Publish response did not include a render link.");
      }
    } catch (error) {
      toast.error("Failed to publish report");
      console.error(error);
    } finally {
      setPublishLoading(false);
    }
  };

  // Copy link to clipboard
  const copyLinkToClipboard = () => {
    if (publishedLink) {
      navigator.clipboard.writeText(window.location.origin + publishedLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Link copied to clipboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Home
          </Button>
        </div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Report Builder</h1>
          <p className="text-slate-600">Create reports using natural language</p>
        </div>

        {/* Main workflow */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Input and controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Customer Database */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">1</span>
                  Select Customer Database
                </CardTitle>
                <CardDescription>Pick where the analysis should pull schema information from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Customer Database</p>
                  {customerDatabasesQuery.isLoading ? (
                    <p className="text-sm text-slate-500">Loading databases...</p>
                  ) : customerDatabasesQuery.isError ? (
                    <div className="text-sm text-red-600 space-y-1">
                      <p>Failed to load databases. Check console.</p>
                      {customerDatabasesErrorMessage ? (
                        <p className="text-xs text-red-500/80 break-all">
                          Details: {customerDatabasesErrorMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : customerDatabases.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No databases available. Check backend connectivity or credentials.
                    </p>
                  ) : (
                    <Select
                      value={selectedDatabase ?? undefined}
                      onValueChange={(val) => {
                        console.log("[FE] DB selected:", val);
                        setSelectedDatabase(val);
                        // reset downstream state, but DO NOT clear options
                        setInference(null);
                        setSqlResult(null);
                        setSchemaReview(null);
                        setFieldMetadata([]);
                        setShowSchemaReview(false);
                        setPublishedLink(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a database" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerDatabases.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Natural Language Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">2</span>
                  Natural Language Request
                </CardTitle>
                <CardDescription>Describe what report you want to create (after selecting a database)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Report Title</label>
                  <Input
                    placeholder="e.g., Monthly Sales Report"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Request</label>
                  <Textarea
                    placeholder="e.g., Show me total revenue by product category for the last 12 months, filtered by active customers"
                    value={naturalLanguageRequest}
                    onChange={(e) => setNaturalLanguageRequest(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleInference}
                  disabled={
                    inferenceLoading ||
                    !naturalLanguageRequest.trim() ||
                    !selectedDatabase
                  }
                  className="w-full"
                >
                  {inferenceLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Analyze Request
                </Button>
                <Button
                  variant="outline"
                  onClick={openFieldEditor}
                  disabled={!inference}
                  className="w-full"
                >
                  Review & Edit Fields
                </Button>
              </CardContent>
            </Card>

            {/* Optional: Review Inferred Fields */}
            {showFieldEditor && inference && !showSchemaReview && (
              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                      ⓘ
                    </span>
                    Review & Edit Fields
                  </CardTitle>
                  <CardDescription>
                    Verify the extracted fields are correct before generating SQL
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InferenceReviewTable
                    metrics={inference.metrics || []}
                    dimensions={inference.dimensions || []}
                    onFieldsChange={setEditedFields}
                    onApply={() => {
                      const pendingFields =
                        editedFields.length > 0
                          ? editedFields
                          : [
                              ...inference.metrics.map(name => ({
                                name,
                                type: "metric" as const,
                                description: "",
                              })),
                              ...inference.dimensions.map(name => ({
                                name,
                                type: "dimension" as const,
                                description: "",
                              })),
                            ];
                      const updatedMetrics = pendingFields.filter(f => f.type === "metric").map(f => f.name);
                      const updatedDimensions = pendingFields.filter(f => f.type === "dimension").map(f => f.name);
                      setInference({
                        ...inference,
                        metrics: updatedMetrics,
                        dimensions: updatedDimensions,
                      });
                      setShowFieldEditor(false);
                      toast.success("Field list updated.");
                    }}
                    onClose={() => setShowFieldEditor(false)}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step 3: Generate SQL */}
            {inference && !showSchemaReview && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">3</span>
                    Generate SQL
                  </CardTitle>
                  <CardDescription>Create SQL query from your request</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleGenerateSQL}
                    disabled={sqlLoading || !selectedDatabase || hasSchemaGaps}
                    className="w-full"
                  >
                    {sqlLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate SQL Query
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 3.5: Schema Review */}
            {sqlResult && schemaReview && !showSchemaReview && !publishedLink && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold">✓</span>
                    SQL Generated Successfully
                  </CardTitle>
                  <CardDescription>Review the schema and configure your report</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowSchemaReview(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Review Schema & Configure Report
                  </Button>
                </CardContent>
              </Card>
            )}

            {showSchemaReview && schemaReview && !publishedLink && (
              <SchemaReviewPanel
                schemaReview={schemaReview}
                onSchemaReviewChange={setSchemaReview}
                onBack={() => setShowSchemaReview(false)}
                onContinue={() => {
                  setShowSchemaReview(false);
                }}
              />
            )}

            {/* Step 4: Publish */}
            {sqlResult && !showSchemaReview && !publishedLink && schemaReview && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">4</span>
                    Publish Report
                  </CardTitle>
                  <CardDescription>Save and generate render link</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handlePublish}
                    disabled={publishLoading || !reportTitle.trim()}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {publishLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Publish Report
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Published Success */}
            {publishedLink && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-900">Report Published Successfully!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 bg-white p-3 rounded border border-green-200">
                    <code className="flex-1 text-sm text-slate-700 break-all">
                      {window.location.origin + publishedLink}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyLinkToClipboard}
                      className="flex-shrink-0"
                    >
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      setReportTitle("");
                      setNaturalLanguageRequest("");
                      setSelectedDatabase(null);
                      setFieldMetadata([]);
                      setInference(null);
                      setSqlResult(null);
                      setSchemaReview(null);
                      setShowSchemaReview(false);
                      setPublishedLink(null);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Create Another Report
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Preview panels */}
          <div className="space-y-6">
            {/* Inference Preview */}
            {inference && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Inferred Elements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Metrics</h4>
                    <div className="flex flex-wrap gap-2">
                      {inference.metrics?.length > 0 ? (
                        inference.metrics.map((m, i) => <Badge key={i} variant="secondary">{m}</Badge>)
                      ) : (
                        <span className="text-xs text-slate-500">None detected</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Dimensions</h4>
                    <div className="flex flex-wrap gap-2">
                      {inference.dimensions?.length > 0 ? (
                        inference.dimensions.map((d, i) => <Badge key={i} variant="outline">{d}</Badge>)
                      ) : (
                        <span className="text-xs text-slate-500">None detected</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Filters</h4>
                    {inference.filters?.length > 0 ? (
                      <div className="space-y-2">
                        {inference.filters.map((f, i) => (
                          <div key={i} className="text-xs bg-slate-100 p-2 rounded">
                            <span className="font-medium">{f.field}</span> {f.operator} <span className="font-medium">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">None detected</span>
                    )}
                  </div>
                  {inference.schemaInsights && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase text-slate-500 tracking-wide">Schema Coverage</p>
                          <p className="text-2xl font-bold text-slate-900">
                            {inference.schemaInsights.coveragePercent}%
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {inference.schemaInsights.matchedFields.length} fields matched
                        </div>
                      </div>
                      {inference.schemaInsights.missingFields.length > 0 ? (
                        <div className="text-xs text-amber-700">
                          <p className="font-semibold mb-1">Fields not found:</p>
                          <div className="space-y-1">
                            {inference.schemaInsights.missingFields.map((missing, idx) => (
                              <div key={idx} className="bg-white border border-amber-200 rounded p-2">
                                <p className="font-medium text-amber-900">{missing.name}</p>
                                {missing.suggestions.length > 0 ? (
                                  <p className="text-amber-800">
                                    Suggestions: {missing.suggestions.join(", ")}
                                  </p>
                                ) : (
                                  <p className="text-amber-800">No similar fields found.</p>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 font-medium">
                            SQL generation is disabled until these fields are reconciled. Use "Review & Edit Fields" to update your request.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700">
                          All requested fields were located in the {selectedDatabase} schema.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SQL Preview */}
            {sqlResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Generated SQL</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-64">
                    {sqlResult.sql}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Fields Preview */}
            {fieldMetadata.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Available Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {fieldMetadata.map((field, i) => (
                      <div key={i} className="text-xs border-l-2 border-blue-300 pl-2 py-1">
                        <div className="font-medium text-slate-900">{field.name}</div>
                        <div className="text-slate-500">{field.type}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
