import { useState } from "react";
import type { SchemaField, SemanticRole, AggregationType } from "@shared/schemaTypes";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit2, AlertCircle, Info, AlertTriangle } from "lucide-react";

interface SchemaReviewTableProps {
  fields: SchemaField[];
  onFieldsChange: (fields: SchemaField[]) => void;
}

export function SchemaReviewTable({ fields, onFieldsChange }: SchemaReviewTableProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const updateField = (technicalName: string, updates: Partial<SchemaField>) => {
    const newFields = fields.map(f =>
      f.technicalName === technicalName ? { ...f, ...updates } : f
    );
    onFieldsChange(newFields);
  };

  const getRoleBadgeColor = (role: SemanticRole) => {
    switch (role) {
      case "measure": return "bg-blue-100 text-blue-700 border-blue-300";
      case "dimension": return "bg-purple-100 text-purple-700 border-purple-300";
      case "time": return "bg-green-100 text-green-700 border-green-300";
    }
  };

  const getValidationIcon = (type: "error" | "warning" | "info") => {
    switch (type) {
      case "error": return <AlertCircle className="h-3 w-3 text-red-500" />;
      case "warning": return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case "info": return <Info className="h-3 w-3 text-blue-500" />;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-12">
              <Checkbox 
                checked={fields.every(f => f.included)}
                onCheckedChange={(checked) => {
                  onFieldsChange(fields.map(f => ({ ...f, included: !!checked })));
                }}
              />
            </TableHead>
            <TableHead className="min-w-[200px]">Field</TableHead>
            <TableHead className="min-w-[150px]">Technical Name</TableHead>
            <TableHead className="min-w-[250px]">Description</TableHead>
            <TableHead className="w-[140px]">Role</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[120px]">Aggregation</TableHead>
            <TableHead className="min-w-[200px]">Samples</TableHead>
            <TableHead className="min-w-[180px]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.technicalName} className="hover:bg-slate-50">
              {/* Include Checkbox */}
              <TableCell>
                <Checkbox
                  checked={field.included}
                  onCheckedChange={(checked) => 
                    updateField(field.technicalName, { included: !!checked })
                  }
                />
              </TableCell>

              {/* Display Name (Editable) */}
              <TableCell>
                <div className="space-y-1">
                  <Input
                    value={field.displayName}
                    onChange={(e) => updateField(field.technicalName, { displayName: e.target.value })}
                    className="text-sm font-medium"
                  />
                  {field.validationBadges.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {field.validationBadges.map((badge, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className="text-xs px-1 py-0 h-5"
                        >
                          <span className="mr-1">{getValidationIcon(badge.type)}</span>
                          {badge.metric || badge.message}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TableCell>

              {/* Technical Name (Read-only) */}
              <TableCell>
                <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                  {field.technicalName}
                </code>
              </TableCell>

              {/* Description (Editable with Dialog) */}
              <TableCell>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                      <div className="text-left">
                        <p className="text-xs text-slate-600 line-clamp-2">{field.description}</p>
                        <span className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </span>
                      </div>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Description</DialogTitle>
                      <DialogDescription>
                        Edit the description for {field.displayName}
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      value={field.description}
                      onChange={(e) => updateField(field.technicalName, { description: e.target.value })}
                      rows={4}
                      className="mt-4"
                    />
                  </DialogContent>
                </Dialog>
              </TableCell>

              {/* Role Selector */}
              <TableCell>
                <Select
                  value={field.semanticRole}
                  onValueChange={(value: SemanticRole) => 
                    updateField(field.technicalName, { semanticRole: value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="measure">
                      <Badge className={getRoleBadgeColor("measure")}>Measure</Badge>
                    </SelectItem>
                    <SelectItem value="dimension">
                      <Badge className={getRoleBadgeColor("dimension")}>Dimension</Badge>
                    </SelectItem>
                    <SelectItem value="time">
                      <Badge className={getRoleBadgeColor("time")}>Time</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              {/* Type & Format */}
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="text-xs font-mono">
                    {field.dataType}
                  </Badge>
                  <Badge className="text-xs">
                    {field.dataFormat}
                  </Badge>
                </div>
              </TableCell>

              {/* Aggregation (for measures only) */}
              <TableCell>
                {field.semanticRole === "measure" ? (
                  <Select
                    value={field.aggregation}
                    onValueChange={(value: AggregationType) => 
                      updateField(field.technicalName, { aggregation: value })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUM">SUM</SelectItem>
                      <SelectItem value="AVG">AVG</SelectItem>
                      <SelectItem value="COUNT">COUNT</SelectItem>
                      <SelectItem value="MIN">MIN</SelectItem>
                      <SelectItem value="MAX">MAX</SelectItem>
                      <SelectItem value="NONE">NONE</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-slate-400">N/A</span>
                )}
              </TableCell>

              {/* Sample Values */}
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {field.samples.slice(0, 3).map((sample, i) => (
                    <Badge 
                      key={i} 
                      variant="secondary" 
                      className="text-xs font-mono"
                    >
                      {sample.value}
                    </Badge>
                  ))}
                  {field.samples.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{field.samples.length - 3} more
                    </Badge>
                  )}
                </div>
                {field.nullPercentage > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {field.nullPercentage.toFixed(1)}% null
                  </p>
                )}
              </TableCell>

              {/* Source */}
              <TableCell>
                <code className="text-xs text-slate-500 break-all">
                  {field.source}
                </code>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
