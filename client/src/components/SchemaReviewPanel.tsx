import { useState } from "react";
import type { SchemaReview } from "@shared/schemaTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaReviewTable } from "./SchemaReviewTable";
import { ArrowLeft, ArrowRight, Table2, Settings, BarChart3, Eye } from "lucide-react";

interface SchemaReviewPanelProps {
  schemaReview: SchemaReview;
  onSchemaReviewChange: (schemaReview: SchemaReview) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function SchemaReviewPanel({
  schemaReview,
  onSchemaReviewChange,
  onBack,
  onContinue,
}: SchemaReviewPanelProps) {
  // Changed initial tab from "schema" to "preview"
  const [activeTab, setActiveTab] = useState("preview");

  // Debug logging
  console.log("[SchemaReviewPanel] Render - schemaReview:", schemaReview);
  console.log("[SchemaReviewPanel] Render - schemaReview?.fields:", schemaReview?.fields);
  console.log("[SchemaReviewPanel] Render - schemaReview?.parameters:", schemaReview?.parameters);
  console.log("[SchemaReviewPanel] Render - schemaReview?.chartConfig:", schemaReview?.chartConfig);

  // Safety checks
  if (!schemaReview || !schemaReview.fields) {
    console.error("[SchemaReviewPanel] Invalid schemaReview data:", { schemaReview });
    return (
      <Card className="border-2 border-red-200">
        <CardHeader>
          <CardTitle>Error Loading Schema Review</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Schema review data is not available. Please try again.</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  const includedFieldsCount = schemaReview.fields.filter(f => f.included).length;
  const totalFieldsCount = schemaReview.fields.length;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
            3.5
          </span>
          Schema Review
        </CardTitle>
        <CardDescription>
          Review and configure fields, parameters, and visualization settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-900">{includedFieldsCount}</div>
            <div className="text-xs text-slate-600">Fields Included</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-900">{schemaReview.parameters?.length || 0}</div>
            <div className="text-xs text-slate-600">Parameters</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-900">
              {schemaReview.fields.filter(f => f.semanticRole === "measure" && f.included).length}
            </div>
            <div className="text-xs text-slate-600">Measures</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-900">
              {schemaReview.fields.filter(f => f.semanticRole === "dimension" && f.included).length}
            </div>
            <div className="text-xs text-slate-600">Dimensions</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Data Preview
            </TabsTrigger>
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Schema Review
            </TabsTrigger>
            <TabsTrigger value="parameters" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Parameters ({schemaReview.parameters?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Chart Config
            </TabsTrigger>
          </TabsList>

          {/* Schema Review Tab */}
          <TabsContent value="schema" className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 bg-blue-50">
              <p className="text-sm text-slate-700">
                <strong>Tip:</strong> Review each field's role (Measure/Dimension/Time), adjust display names and descriptions, 
                and uncheck any fields you don't want in the report.
              </p>
            </div>
            <SchemaReviewTable
              fields={schemaReview.fields}
              onFieldsChange={(fields) => 
                onSchemaReviewChange({ ...schemaReview, fields })
              }
            />
          </TabsContent>

          {/* Parameters Tab */}
          <TabsContent value="parameters" className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-8 text-center">
              <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Parameters Configuration</h3>
              <p className="text-sm text-slate-600 mb-4">
                {schemaReview.parameters?.length || 0} parameters detected:
              </p>
              <div className="space-y-2 text-left max-w-md mx-auto">
                {(schemaReview.parameters || []).map((param, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-md">
                    <div className="font-medium text-sm text-slate-900">{param.name}</div>
                    <div className="text-xs text-slate-600 mt-1">{param.promptText}</div>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {param.type}
                      </span>
                      {param.allowMultiple && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          Multi-value
                        </span>
                      )}
                      {param.isRange && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Range
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Chart Config Tab */}
          <TabsContent value="chart" className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-8 text-center">
              <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Chart Configuration</h3>
              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="text-xs text-slate-600 mb-1">Chart Type</div>
                  <div className="font-medium text-sm text-slate-900">{schemaReview.chartConfig?.type || "None"}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="text-xs text-slate-600 mb-1">X-Axis (Category)</div>
                  <div className="font-medium text-sm text-slate-900">{schemaReview.chartConfig?.xAxis || "None"}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="text-xs text-slate-600 mb-1">Series</div>
                  <div className="font-medium text-sm text-slate-900">{schemaReview.chartConfig?.series || "None"}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="text-xs text-slate-600 mb-1">Values (Y-Axis)</div>
                  <div className="font-medium text-sm text-slate-900">
                    {schemaReview.chartConfig?.values?.join(", ") || "None"}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Data Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            {(() => {
              const preview = schemaReview.dataPreview;
              if (preview && preview.rows.length > 0) {
                const columns = Object.keys(preview.rows[0]);
                return (
                  <div className="rounded-lg border border-slate-200 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          {columns.map(key => (
                            <th key={key} className="px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-slate-100">
                            {columns.map(key => (
                              <td key={key} className="px-4 py-2 text-slate-600">
                                {String(row[key] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 text-xs text-slate-500">
                      Showing {preview.rows.length} of {preview.totalRows} rows.
                    </div>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-slate-200 p-8 text-center">
                  <Eye className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Data Preview</h3>
                  <p className="text-sm text-slate-600">
                    Data preview will show sample results once the report is executed
                  </p>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to SQL
          </Button>
          <Button onClick={onContinue} className="bg-green-600 hover:bg-green-700">
            Continue to Publish
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
