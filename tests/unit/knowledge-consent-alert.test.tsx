import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeConsentAlert } from "@/components/search/knowledge-consent-alert";

afterEach(() => {
  cleanup();
});

describe("KnowledgeConsentAlert", () => {
  it("explains the local-only boundary and keeps cancel confirmation-free", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <KnowledgeConsentAlert
        open
        mode="local"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("alertdialog", { name: "构建本地个人网页知识库？" })).toBeInTheDocument();
    for (const copy of [
      "公开可访问的网页正文",
      "完全在当前浏览器中运行",
      "不使用 OpenAI、DeepSeek 或其他 AI API",
      "不会上传你的搜索词和网页正文",
      "不会携带 Cookie",
      "原收藏、分类、偏好、快照和同步数据不会被修改",
    ]) {
      expect(screen.getByText((text) => text.includes(copy))).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "暂不构建" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    cleanup();
    onOpenChange.mockClear();

    render(
      <KnowledgeConsentAlert
        open
        mode="local"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "同意并开始构建" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
