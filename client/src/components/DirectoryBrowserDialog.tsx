import { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, File, ChevronRight, Home, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface DirectoryBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export function DirectoryBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath = "",
}: DirectoryBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || "");
  const [fileName, setFileName] = useState("report.rdl");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);

  const { data, isLoading, refetch } = trpc.report.browseDirectory.useQuery(
    { path: currentPath },
    { enabled: open && !!currentPath }
  );

  useEffect(() => {
    if (data?.entries) {
      setEntries(data.entries);
    }
  }, [data]);

  useEffect(() => {
    if (open && currentPath) {
      refetch();
    }
  }, [currentPath, open, refetch]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleSelectDirectory = () => {
    const fullPath = currentPath.endsWith("/") || currentPath.endsWith("\\")
      ? `${currentPath}${fileName}`
      : `${currentPath}/${fileName}`;
    onSelect(fullPath);
    onOpenChange(false);
  };

  const goToParent = () => {
    if (!currentPath) return;
    const separator = currentPath.includes("\\") ? "\\" : "/";
    const parts = currentPath.split(separator).filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? parts.join(separator) : separator);
  };

  const goToHome = () => {
    // Try to navigate to a sensible home directory based on OS
    const isWindows = currentPath.includes("\\") || /^[A-Z]:/i.test(currentPath);
    setCurrentPath(isWindows ? "C:\\" : "/");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Directory</DialogTitle>
          <DialogDescription>
            Browse and select where to save the RDL file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Path Display */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={goToHome}
              disabled={isLoading}
            >
              <Home className="h-4 w-4" />
            </Button>
            <Input
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              placeholder="Enter path or browse below"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={goToParent}
              disabled={isLoading || !currentPath}
            >
              Up
            </Button>
          </div>

          {/* Directory Listing */}
          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No entries found or enter a path above
              </div>
            ) : (
              <div className="p-2">
                {entries
                  .sort((a, b) => {
                    // Directories first
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => entry.isDirectory && handleNavigate(entry.path)}
                      disabled={!entry.isDirectory}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm
                        ${entry.isDirectory ? "hover:bg-accent cursor-pointer" : "opacity-50 cursor-not-allowed"}
                      `}
                    >
                      {entry.isDirectory ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="flex-1 text-left">{entry.name}</span>
                      {entry.isDirectory && <ChevronRight className="h-4 w-4" />}
                    </button>
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* File Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">File Name</label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="report.rdl"
            />
            <p className="text-xs text-muted-foreground">
              Full path: {currentPath}/{fileName}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSelectDirectory}
            disabled={!currentPath || !fileName}
          >
            Select This Directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
