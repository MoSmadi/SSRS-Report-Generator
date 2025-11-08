import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { fetchCustomerDatabases, previewReport, publishReport, type PreviewResponse } from "@/lib/reportApi";
import { useLocation } from "wouter";

type ColumnRole = "metric" | "dimension";

interface ColumnConfig {
  name: string;
  role: ColumnRole;
  type: string;
}

function inferRole(values: unknown[]): ColumnRole {
  const numeric = values.filter(v => typeof v === "number").length;
  if (numeric > values.length / 2) return "metric";
  return "dimension";
}

function inferType(values: unknown[]): string {
  if (values.some(v => typeof v === "number")) return "number";
  if (values.some(v => v instanceof Date)) return "date";
  return "text";
}

export default function SQLReportBuilder() {
  const [, navigate] = useLocation();
  const [reportTitle, setReportTitle] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [sqlText, setSqlText] = useState("");
  const [rowLimit, setRowLimit] = useState("100");
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [publishedLink, setPublishedLink] = useState<string | null>(null);

  const customerDatabasesQuery = useQuery({
    queryKey: ["customerDatabases"],
    queryFn: fetchCustomerDatabases,
  });

  const previewMutation = useMutation({
    mutationFn: previewReport,
  });

  const publishMutation = useMutation({
    mutationFn: publishReport,
  });

  const customerDatabases = customerDatabasesQuery.data || [];

  const metrics = useMemo(() => columns.filter(col => col.role === "metric").map(col => col.name), [columns]);
  const dimensions = useMemo(() => columns.filter(col => col.role === "dimension").map(col => col.name), [columns]);

  const handlePreview = async () => {
    if (!selectedDatabase) {
      toast.error("Select a database first");
      return;
    }
    if (!sqlText.trim()) {
      toast.error("Enter a SQL statement");
      return;
    }

    try {
      const limit = Number(rowLimit) || 100;
      const response = await previewMutation.mutateAsync({
        db: selectedDatabase,
        sql: sqlText,
        params: {},
        limit,
      });

      setPreviewData(response);
      updateColumnsFromPreview(response);
      toast.success("Preview loaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to preview SQL");
    }
  };

  const updateColumnsFromPreview = (preview: PreviewResponse) => {
    if (!preview.rows?.length) return;
    const firstRow = preview.rows[0];
    const keys = Object.keys(firstRow);
    setColumns(prev => {
      const prevMap = new Map(prev.map(col => [col.name, col]));
      return keys.map(key => {
        const existing = prevMap.get(key);
        if (existing) return existing;
        const values = preview.rows.map(row => row[key]);
        return {
          name: key,
          role: inferRole(values),
          type: inferType(values),
        };
      });
    });
  };

  const handlePublish = async () => {
    if (!reportTitle.trim()) {
      toast.error("Enter a report title");
      return;
    }
    if (!selectedDatabase) {
      toast.error("Select a database");
      return;
    }
    if (!sqlText.trim()) {
      toast.error("Enter a SQL statement");
      return;
    }
    if (columns.length === 0) {
      toast.error("Preview your SQL to detect columns before publishing");
      return;
    }

    try {
      const response = await publishMutation.mutateAsync({
        db: selectedDatabase,
        metadata: { title: reportTitle },
        mapping: {
          metrics,
          dimensions,
          filters: [],
        },
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          role: col.role,
          description: "",
        })),
        parameters: [],
        filters: [],
        chart: undefined,
      });

      if (response?.success && response.renderLink) {
        setPublishedLink(response.renderLink);
        toast.success("Report published successfully");
      } else if (response?.renderLink) {
        setPublishedLink(response.renderLink);
        toast.success("Report published (render link ready)");
      } else if (response?.error) {
        toast.error(response.error.message ?? "Publish failed");
      } else {
        toast.error("Publish response missing render link");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish report");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Home
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">SQL to Report Builder</h1>
          <p className="text-slate-600">
            Paste a SQL query, preview the data, label columns, and publish without natural language inference.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Report Info</CardTitle>
            <CardDescription>Select a database and name your report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Customer Database</label>
              {customerDatabasesQuery.isLoading ? (
                <p className="text-sm text-slate-500">Loading databases...</p>
              ) : customerDatabasesQuery.isError ? (
                <p className="text-sm text-red-600">Failed to load databases.</p>
              ) : (
                <Select
                  value={selectedDatabase ?? undefined}
                  onValueChange={setSelectedDatabase}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a database" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerDatabases.map(db => (
                      <SelectItem key={db} value={db}>
                        {db}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Report Title</label>
              <Input
                className="mt-1"
                placeholder="My SQL-based report"
                value={reportTitle}
                onChange={e => setReportTitle(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. SQL Query</CardTitle>
            <CardDescription>Provide the SQL you want to use for this report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={10}
              placeholder="SELECT ..."
              value={sqlText}
              onChange={e => setSqlText(e.target.value)}
            />
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Row Limit</label>
                <Input
                  className="mt-1 w-32"
                  value={rowLimit}
                  onChange={e => setRowLimit(e.target.value)}
                  type="number"
                  min={1}
                />
              </div>
              <Button onClick={handlePreview} disabled={previewMutation.isPending}>
                {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preview Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {previewData && (
          <Card>
            <CardHeader>
              <CardTitle>3. Preview Results</CardTitle>
              <CardDescription>Sample rows returned by your SQL</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto">
              {previewData.rows.length === 0 ? (
                <p className="text-sm text-slate-500">No rows returned.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {Object.keys(previewData.rows[0]).map(col => (
                        <th key={col} className="text-left px-3 py-2 border-b text-slate-600">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        {Object.keys(previewData.rows[0]).map(col => (
                          <td key={col} className="px-3 py-2 text-slate-800">
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {columns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>4. Column Roles</CardTitle>
              <CardDescription>Label each column so the report can build metrics and dimensions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {columns.map((column, index) => (
                <div key={column.name} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{column.name}</p>
                    <p className="text-xs text-slate-500">Detected type: {column.type}</p>
                  </div>
                  <div className="w-full md:w-48">
                    <Select
                      value={column.role}
                      onValueChange={value =>
                        setColumns(prev =>
                          prev.map((col, idx) =>
                            idx === index ? { ...col, role: value as ColumnRole } : col
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric (aggregated)</SelectItem>
                        <SelectItem value="dimension">Dimension (grouping)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>5. Publish</CardTitle>
            <CardDescription>Generate a render link once everything looks good</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full md:w-auto"
              onClick={handlePublish}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish Report
            </Button>
            {publishedLink && (
              <div className="mt-4 text-sm text-slate-700">
                Render Link: <a href={publishedLink} target="_blank" rel="noreferrer" className="text-blue-600 underline">{publishedLink}</a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
