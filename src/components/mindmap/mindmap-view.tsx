import { GitFork } from "lucide-react";

export function MindmapView() {
  return (
    <section className="wc-mindmap-stage" aria-label="导图模式" data-testid="mindmap-stage">
      <div className="wc-mindmap-skeleton" role="status">
        <span className="wc-mindmap-skeleton-icon" aria-hidden="true">
          <GitFork />
        </span>
        <strong>导图模式</strong>
        <span>正在准备收藏关系图</span>
      </div>
    </section>
  );
}
