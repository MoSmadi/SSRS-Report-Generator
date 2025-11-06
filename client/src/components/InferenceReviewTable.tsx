import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InferredField {
  name: string;
  type: "metric" | "dimension";
  description: string;
  source?: string; // e.g., "PurchaseOrders.SuggestedQuantity"
}

interface InferenceReviewTableProps {
  metrics: string[];
  dimensions: string[];
  onFieldsChange: (fields: InferredField[]) => void;
  onApply: () => void;
  onClose: () => void;
}

export function InferenceReviewTable({
  metrics,
  dimensions,
  onFieldsChange,
  onApply,
  onClose,
}: InferenceReviewTableProps) {
  // Convert metrics and dimensions to editable fields
  const [fields, setFields] = useState<InferredField[]>([
    ...metrics.map(m => ({
      name: m,
      type: "metric" as const,
      description: generateDefaultDescription(m, "metric"),
      source: generateDefaultSource(m),
    })),
    ...dimensions.map(d => ({
      name: d,
      type: "dimension" as const,
      description: generateDefaultDescription(d, "dimension"),
      source: generateDefaultSource(d),
    })),
  ]);

  const handleFieldChange = (index: number, field: keyof InferredField, value: string) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [field]: value };
    setFields(newFields);
    onFieldsChange(newFields);
  };

  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    onFieldsChange(newFields);
  };

  const handleAddField = () => {
    const newFields = [...fields, { name: "", type: "metric" as const, description: "" }];
    setFields(newFields);
    onFieldsChange(newFields);
  };

  const metricsCount = fields.filter(f => f.type === "metric").length;
  const dimensionsCount = fields.filter(f => f.type === "dimension").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex-1">
          <div className="text-2xl font-bold text-blue-900">{fields.length}</div>
          <div className="text-xs text-blue-700">Total Fields</div>
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-purple-900">{metricsCount}</div>
          <div className="text-xs text-purple-700">Metrics</div>
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-green-900">{dimensionsCount}</div>
          <div className="text-xs text-green-700">Dimensions</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Review the extracted fields:</strong> Verify field names, types, and descriptions. 
          Edit any incorrect information before generating SQL.
        </p>
      </div>

      {/* Editable Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[25%]">Field Name</TableHead>
              <TableHead className="w-[15%]">Type</TableHead>
              <TableHead className="w-[25%]">Data Source</TableHead>
              <TableHead className="w-[25%]">Description</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  No fields detected. Click "Add Field" to manually add fields.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field, index) => (
                <TableRow key={index} className="hover:bg-slate-50">
                  <TableCell>
                    <Input
                      value={field.name}
                      onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                      placeholder="Field name"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={field.type}
                      onValueChange={(value) => handleFieldChange(index, "type", value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">
                          <Badge variant="secondary" className="text-xs">Metric</Badge>
                        </SelectItem>
                        <SelectItem value="dimension">
                          <Badge variant="outline" className="text-xs">Dimension</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={field.source || ""}
                      onChange={(e) => handleFieldChange(index, "source", e.target.value)}
                      placeholder="e.g., Orders.TotalAmount"
                      className="h-9 font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={field.description}
                      onChange={(e) => handleFieldChange(index, "description", e.target.value)}
                      placeholder="Describe this field..."
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteField(index)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Field Button */}
      <Button
        variant="outline"
        onClick={handleAddField}
        className="w-full border-dashed"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Field
      </Button>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={onApply} 
          disabled={fields.length === 0 || fields.some(f => !f.name.trim())}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Apply Edits
        </Button>
      </div>
    </div>
  );
}

// Helper function to generate default descriptions
function generateDefaultDescription(fieldName: string, type: "metric" | "dimension"): string {
  const name = fieldName.toLowerCase();
  
  if (type === "metric") {
    if (name.includes("qty") || name.includes("quantity")) return "Numeric quantity or count";
    if (name.includes("amount") || name.includes("total")) return "Total numeric value";
    if (name.includes("on hand")) return "Current inventory level";
    if (name.includes("consumption")) return "Usage or consumption amount";
    if (name.includes("estimated")) return "Calculated estimate";
    if (name.includes("variance")) return "Difference between values";
    if (name.includes("waste")) return "Waste quantity";
    if (name.includes("transfer")) return "Transfer quantity";
    return "Numeric measure to calculate";
  } else {
    if (name.includes("date")) return "Date or timestamp field";
    if (name.includes("location")) return "Location or site identifier";
    if (name.includes("order")) return "Order reference";
    if (name.includes("item")) return "Item or product identifier";
    if (name.includes("u of m") || name.includes("uom")) return "Unit of measure";
    return "Categorical field for grouping";
  }
}

// Helper function to generate default data source mapping
function generateDefaultSource(fieldName: string): string {
  const name = fieldName.toLowerCase();
  
  // Map common field patterns to likely table.column sources
  if (name.includes("suggested qty") || name === "suggested qty") return "PurchaseOrders.SuggestedQuantity";
  if (name.includes("actual order qty") || name === "actual order qty") return "PurchaseOrders.ActualOrderQuantity";
  if (name.includes("order date actual on hand")) return "Inventory.ActualOnHand";
  if (name.includes("order date theo on hand")) return "Inventory.TheoreticalOnHand";
  if (name.includes("consumption period transfers")) return "Transfers.TransferQuantity";
  if (name.includes("consumption period waste")) return "Waste.WasteQuantity";
  if (name.includes("consumption period estimated usage")) return "Usage.EstimatedUsage";
  if (name.includes("estimated need")) return "PurchaseOrders.EstimatedNeed";
  if (name.includes("post consumption on hand suggested")) return "Inventory.PostConsumptionSuggested";
  if (name.includes("post consumption on hand ordered")) return "Inventory.PostConsumptionOrdered";
  if (name.includes("post consumption on hand variance")) return "Inventory.PostConsumptionVariance";
  if (name.includes("case size")) return "Items.CaseSize";
  if (name.includes("consumption days")) return "PurchaseOrders.ConsumptionDays";
  if (name.includes("buffer days")) return "PurchaseOrders.BufferDays";
  
  if (name === "location") return "Locations.LocationName";
  if (name === "order") return "PurchaseOrders.OrderNumber";
  if (name === "item") return "Items.ItemName";
  if (name.includes("ordering u of m")) return "Items.OrderingUnitOfMeasure";
  if (name.includes("inventory u of m")) return "Items.InventoryUnitOfMeasure";
  if (name === "date") return "PurchaseOrders.Date";
  
  // Default: try to guess table name from field name
  const words = fieldName.split(/\s+/);
  if (words.length > 0) {
    const tableName = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return `${tableName}.${fieldName.replace(/\s+/g, '')}`;
  }
  
  return "Unknown.Column";
}
