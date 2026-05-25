"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, Clock3, HardDrive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import {
  listCloudWorkspaceSnapshots,
  restoreCloudWorkspaceSnapshot,
  restoreStructureFromCloudWorkspaceSnapshot,
  type CloudWorkspaceSnapshotEntry,
} from "@/lib/cloud-snapshots";
import {
  assessLocalDataSnapshot,
  getLocalDataSnapshots,
  restoreLocalDataSnapshot,
  restoreStructureFromLocalSnapshot,
  type LocalSnapshotEntry,
} from "@/lib/local-snapshots";
import { useAppStore } from "@/lib/store";

interface LocalSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SnapshotLike = LocalSnapshotEntry | CloudWorkspaceSnapshotEntry;

function isCloudSnapshot(snapshot: SnapshotLike): snapshot is CloudWorkspaceSnapshotEntry {
  return (snapshot as CloudWorkspaceSnapshotEntry).source === "cloud";
}

function snapshotKey(snapshot: SnapshotLike): string {
  return `${isCloudSnapshot(snapshot) ? "cloud" : "local"}:${snapshot.id}`;
}

function formatSnapshotTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSnapshotDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCounts(snapshot: SnapshotLike): string {
  const { counts } = snapshot;
  return `${counts.sections} 分项 / ${counts.categories} 分类分组 / ${counts.cards} 网页 / 仓库 ${counts.warehouseCards}`;
}

function formatReason(snapshot: SnapshotLike): string {
  if (isCloudSnapshot(snapshot)) {
    return snapshot.kind === "manual" ? "云端手动保存" : "云端每日自动保存";
  }
  const labels: Record<string, string> = {
    "manual-snapshot": "本地手动保存",
    "before-clear-all-data": "清空前备份",
    "before-local-rollback": "回档前备份",
    "before-structure-only-restore": "修结构前备份",
    "before-cloud-row-delete": "云端删行前备份",
    "before-cloud-rollback": "云端回档前备份",
    "before-cloud-structure-restore": "云端结构修复前备份",
    "cloud-layout-dedupe-candidate": "云端结构候选",
    "auto-local-edit": "自动备份",
    "auto-local-change": "本地系统自动保存",
  };
  if (labels[snapshot.reason]) return labels[snapshot.reason];
  if (snapshot.reason.startsWith("auto-")) return "本地系统自动保存";
  if (snapshot.reason.startsWith("before-")) return "操作前系统备份";
  return snapshot.reason;
}

function filterByDate<T extends SnapshotLike>(snapshots: T[], selectedDate: string): T[] {
  if (selectedDate === "all") return snapshots;
  return snapshots.filter((snapshot) => formatSnapshotDate(snapshot.createdAt) === selectedDate);
}

export function LocalSnapshotDialog({ open, onOpenChange }: LocalSnapshotDialogProps) {
  const user = useAuthStore((state) => state.user);
  const [localSnapshots, setLocalSnapshots] = useState<LocalSnapshotEntry[]>([]);
  const [cloudSnapshots, setCloudSnapshots] = useState<CloudWorkspaceSnapshotEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [structureRestoringId, setStructureRestoringId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("all");

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextLocalSnapshots = await getLocalDataSnapshots();
      let nextCloudSnapshots: CloudWorkspaceSnapshotEntry[] = [];
      if (user) {
        try {
          nextCloudSnapshots = await listCloudWorkspaceSnapshots(user.id);
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : "读取云端版本失败。");
        }
      }
      setLocalSnapshots(nextLocalSnapshots);
      setCloudSnapshots(nextCloudSnapshots);
      const dateStillExists = [...nextLocalSnapshots, ...nextCloudSnapshots]
        .some((snapshot) => formatSnapshotDate(snapshot.createdAt) === selectedDate);
      if (selectedDate !== "all" && !dateStillExists) {
        setSelectedDate("all");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, user]);

  useEffect(() => {
    if (open) {
      void loadSnapshots();
    }
  }, [loadSnapshots, open]);

  const handleRestore = async (snapshot: SnapshotLike) => {
    const ok = window.confirm(
      `恢复到 ${formatSnapshotTime(snapshot.createdAt)} 的${isCloudSnapshot(snapshot) ? "云端" : "本地"}版本？当前版本会先自动备份。`
    );
    if (!ok) return;
    const key = snapshotKey(snapshot);
    setRestoringId(key);
    try {
      if (isCloudSnapshot(snapshot)) {
        if (!user) throw new Error("请先登录后再恢复云端版本。");
        await restoreCloudWorkspaceSnapshot(user.id, snapshot.id);
      } else {
        await restoreLocalDataSnapshot(snapshot.id);
      }
      await useAppStore.getState().loadData();
      onOpenChange(false);
    } finally {
      setRestoringId(null);
    }
  };

  const handleStructureRestore = async (snapshot: SnapshotLike) => {
    const ok = window.confirm(
      `只修复 ${formatSnapshotTime(snapshot.createdAt)} 的分项/分类/分组关系？当前新增网页会保留，不做整库回档。`
    );
    if (!ok) return;
    const key = snapshotKey(snapshot);
    setStructureRestoringId(key);
    try {
      if (isCloudSnapshot(snapshot)) {
        if (!user) throw new Error("请先登录后再恢复云端结构。");
        await restoreStructureFromCloudWorkspaceSnapshot(user.id, snapshot.id);
      } else {
        await restoreStructureFromLocalSnapshot(snapshot.id);
      }
      await useAppStore.getState().loadData();
      onOpenChange(false);
    } finally {
      setStructureRestoringId(null);
    }
  };

  const allSnapshots = [...cloudSnapshots, ...localSnapshots];
  const dateOptions = Array.from(new Set(allSnapshots.map((snapshot) => formatSnapshotDate(snapshot.createdAt))));
  const visibleCloudSnapshots = filterByDate(cloudSnapshots, selectedDate);
  const visibleLocalSnapshots = filterByDate(localSnapshots, selectedDate);
  const cloudManualSnapshots = visibleCloudSnapshots.filter((snapshot) => snapshot.kind === "manual");
  const cloudSystemSnapshots = visibleCloudSnapshots.filter((snapshot) => snapshot.kind === "system");
  const localFallbackSnapshots = visibleLocalSnapshots;

  const renderSnapshotCard = (snapshot: SnapshotLike) => {
    const assessment = isCloudSnapshot(snapshot) ? snapshot.assessment : assessLocalDataSnapshot(snapshot);
    const key = snapshotKey(snapshot);
    return (
      <div key={key} className="rounded-md border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              {isCloudSnapshot(snapshot) ? (
                <Cloud className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              ) : (
                <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{formatSnapshotTime(snapshot.createdAt)}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {snapshot.label}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {formatReason(snapshot)}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  assessment.recoverable
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {assessment.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatCounts(snapshot)}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{assessment.details}</p>
            {snapshot.sectionNames.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {"分项："}
                {snapshot.sectionNames.join("、")}
              </p>
            )}
            {snapshot.sampleCategoryNames.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {"分类："}
                {snapshot.sampleCategoryNames.join("、")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStructureRestore(snapshot)}
              disabled={structureRestoringId === key}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {"只修结构"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleRestore(snapshot)}
              disabled={restoringId === key}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {"恢复全部"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    caption: string,
    snapshots: SnapshotLike[],
    emptyText: string
  ) => (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{snapshots.length > 0 ? `${snapshots.length} 个版本` : caption}</span>
      </div>
      {snapshots.length > 0 ? (
        snapshots.map(renderSnapshotCard)
      ) : (
        <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
          {emptyText}
        </div>
      )}
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{"版本回档"}</DialogTitle>
          <DialogDescription>
            {"这里显示账号云端版本和本地兜底备份。手动保存跟随账号；系统自动保存每天云端仅保留最新一版。"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {"覆盖范围：分项、分类、分组、网页、回收站、仓库和偏好设置。"}
          </p>
        </div>

        {dateOptions.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{"按日期筛选"}</span>
            <select
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">{"全部日期"}</option>
              {dateOptions.map((date) => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
        )}

        {loadError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {loadError}
          </div>
        )}

        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              {"正在读取版本库..."}
            </div>
          ) : allSnapshots.length === 0 ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              {user
                ? "还没有找到任何云端或本地版本。点顶部“保存”后，手动版本会写入云端账号。"
                : "还没有找到本地历史版本。登录后，手动版本会保存到云端并跟随账号。"}
            </div>
          ) : (
            <>
              {renderSection(
                "云端手动保存",
                user ? "暂无手动版本" : "未登录",
                cloudManualSnapshots,
                user
                  ? "顶部“保存”会把当前完整工作区永久保存到这里。"
                  : "登录后才能读取账号级手动版本。"
              )}
              {renderSection(
                "云端每日自动保存",
                user ? "每天仅保留最新一版" : "未登录",
                cloudSystemSnapshots,
                user
                  ? "系统会按天覆盖同一天的自动备份，避免一分钟一个版本。"
                  : "登录后才能读取账号级自动备份。"
              )}
              {renderSection(
                "本地兜底备份",
                "删除扩展会丢失",
                localFallbackSnapshots,
                "本地备份只保存在当前浏览器/扩展实例，删除扩展可能会清空。"
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {"关闭"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
