"use client";

import { useRef, useState } from "react";
import { Download, FileCheck2, FileUp, HardDrive, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import type { CloudSnapshotRecord } from "@/lib/cloud-sync-types";
import { googleDriveSyncProvider } from "@/lib/google-drive-sync";
import {
  createPortableBackup,
  downloadPortableBackup,
  parsePortableBackup,
  restorePortableBackup,
  type PortableBackupPreview,
  type PortableBackupV1,
} from "@/lib/portable-backup";
import { useAppStore } from "@/lib/store";

interface DataBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cloudLabel(status: PortableBackupPreview["cloudStatus"]): string {
  if (status === "included") return "已包含 Google Drive 历史版本";
  if (status === "local-only") return "仅本机备份（云盘暂时不可用）";
  return "本机备份（未连接 Google Drive）";
}

export function DataBackupDialog({ open, onOpenChange }: DataBackupDialogProps) {
  const { isLoggedIn, manualSync } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "read" | "restore" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingBackup, setPendingBackup] = useState<PortableBackupV1 | null>(null);
  const [preview, setPreview] = useState<PortableBackupPreview | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  const exportBackup = async () => {
    setBusy("export");
    setError("");
    setMessage("");
    try {
      let driveSnapshots: CloudSnapshotRecord[] = [];
      let cloudStatus: "not-connected" | "included" | "local-only" = "not-connected";
      if (isLoggedIn) {
        try {
          driveSnapshots = await googleDriveSyncProvider.listSnapshots();
          cloudStatus = "included";
        } catch {
          cloudStatus = "local-only";
        }
      }
      const backup = await createPortableBackup({ cloudStatus, driveSnapshots });
      downloadPortableBackup(backup);
      setMessage(cloudStatus === "included"
        ? "完整 JSON 已下载，并包含当前可读取的 Google Drive 历史版本。"
        : "JSON 已下载。本次只包含本机可读取的数据和版本历史。");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出完整备份失败。");
    } finally {
      setBusy(null);
    }
  };

  const readBackupFile = async (file: File | null) => {
    if (!file) return;
    setBusy("read");
    setError("");
    setMessage("");
    setPendingBackup(null);
    setPreview(null);
    try {
      const parsed = await parsePortableBackup(await file.text());
      setPendingBackup(parsed.backup);
      setPreview(parsed.preview);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "读取备份失败。");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirmRestore = async () => {
    if (!pendingBackup) return;
    setBusy("restore");
    setError("");
    setMessage("");
    try {
      const result = await restorePortableBackup(pendingBackup, { confirmed: true });
      await useAppStore.getState().loadData();
      if (isLoggedIn) {
        await manualSync({ reloadView: false });
      }
      setMessage(
        `恢复完成：${result.restoredCounts.cards} 个网页、${result.restoredCounts.categories} 个分类分组。`
      );
      setPendingBackup(null);
      setPreview(null);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "恢复完整备份失败。");
    } finally {
      setBusy(null);
      setConfirmRestoreOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              数据与完整备份
            </DialogTitle>
            <DialogDescription>
              导出普通可读的 JSON，包含工作区、回收站、仓库、壁纸、导图视图、本地版本和可读取的云盘版本。
              文件不包含 Google 或 Supabase 凭证、访问令牌和临时同步状态。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Download className="h-4 w-4" />
                导出完整 JSON
              </div>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                普通 JSON 不额外加密，请像保管个人文件一样妥善保存。未连接或离线时会明确标记为“仅本机备份”。
              </p>
              <Button className="w-full" onClick={() => void exportBackup()} disabled={busy !== null}>
                {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                导出完整备份
              </Button>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileUp className="h-4 w-4" />
                预览并恢复
              </div>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                先检查版本、结构、数量和 SHA-256。通过后仍需再次确认，系统才会创建“导入前安全版本”并恢复。
              </p>
              <input
                ref={inputRef}
                className="hidden"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void readBackupFile(event.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => inputRef.current?.click()}
                disabled={busy !== null}
              >
                {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                选择 JSON 并预览
              </Button>
            </section>
          </div>

          {preview && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-slate-700">
              <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-700">
                <FileCheck2 className="h-4 w-4" />
                校验通过，尚未写入任何数据
              </div>
              <div className="grid gap-1 text-xs sm:grid-cols-2">
                <span>创建时间：{formatDate(preview.createdAt)}</span>
                <span>应用版本：V{preview.appVersion}</span>
                <span>网页：{preview.counts.cards}</span>
                <span>分类分组：{preview.counts.categories}</span>
                <span>分项：{preview.counts.sections}</span>
                <span>回收站：{preview.counts.recycleBin}</span>
                <span>仓库网页：{preview.counts.warehouseCards}</span>
                <span>云盘版本：{preview.counts.driveSnapshots}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{cloudLabel(preview.cloudStatus)}</p>
              <p className="mt-1 break-all font-mono text-[10px] text-slate-400">SHA-256：{preview.contentHash}</p>
              <Button className="mt-3" onClick={() => setConfirmRestoreOpen(true)} disabled={busy !== null}>
                恢复这个备份
              </Button>
            </section>
          )}

          {message && <div className="wc-inline-message p-3 text-xs leading-relaxed">{message}</div>}
          {error && <div className="wc-inline-message-danger p-3 text-xs leading-relaxed">{error}</div>}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy === "restore"}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRestoreOpen} onOpenChange={setConfirmRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复这份完整备份？</AlertDialogTitle>
            <AlertDialogDescription>
              系统会先保存当前完整状态作为“导入前安全版本”，然后恢复预览中的工作区。
              未包含在备份里的其他导图视图不会被删除；Google Drive 同步会在恢复完成后再继续。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "restore"}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRestore()} disabled={busy === "restore"}>
              {busy === "restore" && <Loader2 className="h-4 w-4 animate-spin" />}
              创建安全版本并恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
