"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, CheckCircle, Package, Plus, RefreshCw } from "lucide-react";
import { parseImportJSON, detectJsonFormat, type ImportPreview, type ParseResult, type SkippedItem } from "@/lib/import-parser";
import type { ImportBatch, WarehouseCategory, WarehouseCard } from "@/lib/db-warehouse";
import { useWarehouseStore } from "@/lib/store-warehouse";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = "upload" | "preview" | "done";

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { importToWarehouse, loadData } = useWarehouseStore();
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "overwrite">("append");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setPreview(null);
    setParseResult(null);
    setError(null);
    setImporting(false);
    setImportMode("append");
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  }, [onOpenChange, reset]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const json = JSON.parse(text);

        // Detect format
        const format = detectJsonFormat(json);
        if (format === "unknown") {
          setError("无法识别的 JSON 格式。目前仅支持可导入的 JSON 文件。");
          return;
        }

        // Parse
        const result = parseImportJSON(json, file.name);
        setParseResult(result);
        setPreview(result.preview);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "解析 JSON 文件失败");
      }
    };
    reader.onerror = () => setError("读取文件失败");
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  }, []);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;

    setImporting(true);
    try {
      const batchId = `batch-${Date.now()}`;
      const batch: ImportBatch = {
        id: batchId,
        source: preview?.source || "unknown",
        sourceFileName: fileName,
        importedAt: Date.now(),
        categoryCount: parseResult.categories.length,
        cardCount: parseResult.cards.length,
        note: "",
      };

      // Assign batchId to all items
      const catsWithBatch: WarehouseCategory[] = parseResult.categories.map((c) => ({
        ...c,
        importBatchId: batchId,
      }));
      const cardsWithBatch: WarehouseCard[] = parseResult.cards.map((c) => ({
        ...c,
        importBatchId: batchId,
      }));

      await importToWarehouse(catsWithBatch, cardsWithBatch, batch, importMode);
      await loadData();
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }, [parseResult, preview, fileName, importMode, importToWarehouse, loadData]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Package className="h-5 w-5" />
            导入书签到仓库
          </DialogTitle>
          <DialogDescription>
            上传 JSON 文件，自动识别并导入分类和书签
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-4 min-w-0">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-foreground font-medium">点击选择 JSON 文件</p>
              <p className="text-xs text-muted-foreground mt-1">
                支持可导入的 JSON 文件
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-4 py-4">
            {/* File info */}
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{fileName}</span>
              <Badge variant="secondary" className="text-[10px]">
                {preview.source === "homely" ? "JSON 格式" : "通用格式"}
              </Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{preview.totalGroups}</div>
                <div className="text-xs text-muted-foreground">原始分组</div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{preview.totalCards}</div>
                <div className="text-xs text-muted-foreground">有效书签</div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{preview.parentCategories}</div>
                <div className="text-xs text-muted-foreground">分类（父级）</div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{preview.subGroups}</div>
                <div className="text-xs text-muted-foreground">独立分组</div>
              </div>
            </div>

            {preview.skippedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  有 {preview.skippedItems.length} 个条目未被导入
                </div>
                <details className="group min-w-0">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    查看未识别条目详情 →
                  </summary>
                  <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto overflow-x-hidden pr-1">
                    {preview.skippedItems.map((item: SkippedItem, idx: number) => (
                      <div key={idx} className="flex min-w-0 items-start gap-2 p-2 rounded bg-muted/30 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{item.itemTitle}</div>
                          <div className="text-muted-foreground break-all leading-relaxed">{item.url || "(空 URL)"}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-muted-foreground">
                              {item.reason === "chrome-extension" ? "依赖浏览器扩展" :
                               item.reason === "empty-url" ? "无有效链接" : "无效链接"}
                            </span>
                            {item.retryable && (
                              <span className="text-primary">可重试</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Import mode */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">导入模式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`p-3 rounded-md border text-left transition-colors ${
                    importMode === "append"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setImportMode("append")}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">追加导入</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    保留仓库现有数据，新导入追加到后面
                  </p>
                </button>
                <button
                  className={`p-3 rounded-md border text-left transition-colors ${
                    importMode === "overwrite"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setImportMode("overwrite")}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-sm font-medium">覆盖导入</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    清空仓库现有数据，用新数据替换
                  </p>
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-serif font-semibold text-foreground">导入完成</p>
              <p className="text-sm text-muted-foreground mt-1">
                成功导入 {preview?.totalCards} 个书签到仓库
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              取消
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setError(null); }}>
                返回
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-1" />
                    确认导入
                  </>
                )}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => handleClose(false)}>
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
