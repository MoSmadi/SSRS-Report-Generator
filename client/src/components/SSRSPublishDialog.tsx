import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FolderOpen } from "lucide-react";
import { DirectoryBrowserDialog } from "./DirectoryBrowserDialog";

export interface SSRSPublishFormData {
  outputPath: string;
  reportName: string;
}

interface SSRSPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SSRSPublishFormData) => void;
  loading?: boolean;
  reportTitle?: string;
  databaseName?: string;
}

export function SSRSPublishDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  reportTitle = "AutoReport",
  databaseName = "",
}: SSRSPublishDialogProps) {
  const [formData, setFormData] = useState<SSRSPublishFormData>({
    outputPath: "",
    reportName: reportTitle || "AutoReport",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SSRSPublishFormData, string>>>({});
  const [showBrowser, setShowBrowser] = useState(false);

  const handleFileSelect = () => {
    setShowBrowser(true);
  };

  const handleDirectorySelect = (path: string) => {
    handleChange('outputPath', path);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const newErrors: Partial<Record<keyof SSRSPublishFormData, string>> = {};
    
    if (!formData.outputPath.trim()) {
      newErrors.outputPath = "Output path is required";
    } else if (!formData.outputPath.endsWith(".rdl")) {
      newErrors.outputPath = "Output path must end with .rdl";
    }
    
    if (!formData.reportName.trim()) {
      newErrors.reportName = "Report name is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    onSubmit(formData);
  };

  const handleChange = (field: keyof SSRSPublishFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Publish SSRS Report</DialogTitle>
            <DialogDescription>
              Configure the SSRS RDL file generation settings for database: <strong>{databaseName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Output Path */}
            <div className="grid gap-2">
              <Label htmlFor="outputPath">
                Output Path <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="outputPath"
                  placeholder="C:\Reports\MyReport.rdl or /home/user/reports/MyReport.rdl"
                  value={formData.outputPath}
                  onChange={(e) => handleChange("outputPath", e.target.value)}
                  className={errors.outputPath ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleFileSelect}
                  disabled={loading}
                  title="Use default path"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              {errors.outputPath && (
                <p className="text-sm text-red-500">{errors.outputPath}</p>
              )}
              <p className="text-xs text-slate-500">
                Enter the full server path where the .rdl file will be saved (must end with .rdl)
              </p>
            </div>

            {/* Report Name */}
            <div className="grid gap-2">
              <Label htmlFor="reportName">
                Report Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reportName"
                placeholder="AutoReport"
                value={formData.reportName}
                onChange={(e) => handleChange("reportName", e.target.value)}
                className={errors.reportName ? "border-red-500" : ""}
              />
              {errors.reportName && (
                <p className="text-sm text-red-500">{errors.reportName}</p>
              )}
              <p className="text-xs text-slate-500">
                Display name for the report
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate SSRS Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Directory Browser Dialog */}
      <DirectoryBrowserDialog
        open={showBrowser}
        onOpenChange={setShowBrowser}
        onSelect={handleDirectorySelect}
        initialPath={formData.outputPath || "/"}
      />
    </Dialog>
  );
}
