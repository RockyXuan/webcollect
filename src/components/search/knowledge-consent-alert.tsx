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
  mode: "local";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function KnowledgeConsentAlert({
  open,
  mode,
  onOpenChange,
  onConfirm,
}: KnowledgeConsentAlertProps) {
  void mode;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">
            构建本地个人网页知识库？
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              WebCollect 会读取收藏中公开可访问的网页正文，并把它与收藏标题、网站域名、简介、备注和分类路径一起做成本机检索资料。
            </span>
            <span className="block">
              检索和排序完全在当前浏览器中运行，不使用 OpenAI、DeepSeek 或其他 AI API，也不会上传你的搜索词和网页正文。
            </span>
            <span className="block">
              读取公开网页时不会携带 Cookie，也不会访问登录后页面或内网地址。派生索引可随时重建，原收藏、分类、偏好、快照和同步数据不会被修改。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>暂不构建</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            同意并开始构建
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
