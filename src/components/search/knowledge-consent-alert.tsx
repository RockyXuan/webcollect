"use client";

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

interface KnowledgeConsentAlertProps {
  open: boolean;
  mode: "build" | "semantic-only";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function KnowledgeConsentAlert({
  open,
  mode,
  onOpenChange,
  onConfirm,
}: KnowledgeConsentAlertProps) {
  const buildsPublicIndex = mode === "build";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">
            {buildsPublicIndex ? "构建你的个人网页知识库？" : "启用 AI 语义匹配？"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {buildsPublicIndex && (
              <span className="block">
                WebCollect 会读取收藏中公开可访问的网页正文，并把收藏标题、网站域名、简称、简介、详细介绍、备注和分类路径组合成检索文本。
              </span>
            )}
            <span className="block">
              {buildsPublicIndex
                ? "检索文本会发送给 OpenAI 生成向量；启用后，符合最短长度的搜索词也会发送给 OpenAI 生成检索向量。云端只保存向量、内容哈希和网页标识，不保存网页原文。不会携带 Cookie，也不会访问登录后或内网页面。"
                : "启用后，符合最短长度的搜索词会发送给 OpenAI 生成检索向量；新增或修改收藏时，该收藏的标题、网站域名、简称、简介、详细介绍、备注和分类路径也会自动增量发送给 OpenAI，以生成或更新向量。扩展不会读取或上传公开网页正文；公开正文只由 Web 版手动构建。"}
            </span>
            <span className="block">
              OpenAI API 数据默认不用于训练，但可能按其数据政策保留安全日志最多 30 天。
            </span>
            <span className="block">
              原收藏、分类、偏好、快照和同步数据不会被修改；网络或 AI 不可用时仍可继续使用本地搜索。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{buildsPublicIndex ? "暂不构建" : "暂不启用"}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {buildsPublicIndex ? "同意并开始构建" : "同意并启用"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
