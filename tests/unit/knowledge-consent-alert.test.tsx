import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeConsentAlert } from "@/components/search/knowledge-consent-alert";

afterEach(() => {
  cleanup();
});

describe("KnowledgeConsentAlert", () => {
  it.each([
    {
      mode: "build" as const,
      title: "构建你的个人网页知识库？",
      cancelLabel: "暂不构建",
      confirmLabel: "同意并开始构建",
      includedCopy: [
        "公开可访问的网页正文",
        "收藏标题、网站域名、简称、简介、详细介绍、备注和分类路径",
        "搜索词也会发送给 OpenAI",
        "云端只保存向量、内容哈希和网页标识，不保存网页原文",
        "不会携带 Cookie",
      ],
      excludedCopy: "扩展不会批量读取网页正文",
    },
    {
      mode: "semantic-only" as const,
      title: "启用 AI 语义匹配？",
      cancelLabel: "暂不启用",
      confirmLabel: "同意并启用",
      includedCopy: [
        "搜索词会发送给 OpenAI",
        "新增或修改收藏时",
        "标题、网站域名、简称、简介、详细介绍、备注和分类路径也会自动增量发送给 OpenAI",
        "扩展不会读取或上传公开网页正文",
        "公开正文只由 Web 版手动构建",
      ],
      excludedCopy: "WebCollect 会读取收藏中公开可访问的网页正文",
    },
  ])("renders the $mode disclosure and keeps cancel confirmation-free", async ({
    mode,
    title,
    cancelLabel,
    confirmLabel,
    includedCopy,
    excludedCopy,
  }) => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <KnowledgeConsentAlert
        open
        mode={mode}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("alertdialog", { name: title })).toBeInTheDocument();
    for (const copy of includedCopy) {
      expect(screen.getByText((text) => text.includes(copy))).toBeInTheDocument();
    }
    expect(screen.queryByText((text) => text.includes(excludedCopy))).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: cancelLabel }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    cleanup();
    onOpenChange.mockClear();

    render(
      <KnowledgeConsentAlert
        open
        mode={mode}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: confirmLabel }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
