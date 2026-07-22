# WebCollect 收藏元数据（标题/简介）抓取与保存修复执行文档

作者：Claude（Opus 4.8）
日期：2026-07-17
执行者：GPT-5.6 / Codex（按本文件 Step 1→5 逐步实现，每步一个 commit，全绿再进下一步）
审查方式：**逐文件读源码 + 用真实代码复现四个根因 + 原型验证四个修复全部成立**（非纸面推断）

---

## 0. 一句话结论

用户遇到的两类问题（标题、简介）背后是**四个独立根因**，其中最关键的一个解释了"老是改不对"：

> **收藏浮窗保存后，队列 drain 发现 URL 已存在就"跳过、不更新"现有卡片（`src/lib/floating-capture.ts:748-756`）。用户在浮窗里改的标题/简介被静默丢弃，看起来就像"改了没反应、改不对"。**

四个根因我已用项目真实代码全部复现（证据见 §3），四个修复我已原型验证全部有效（§4 每步附验证）。

---

## 1. 用户诉求（原话拆解）

| 编号 | 类别 | 需求 | 现象（bug） |
|---|---|---|---|
| 1a | 标题·质量 | 收藏 GitHub 时标题=项目名（如 `codex-slides`） | 标题是超长的 `nexu-io/codex-slides: 🎨 Open-source...` |
| 1b | 标题·同步 | 手动改标题保存后应生效 | 改成 `codex-sliders` 保存，去 App 看仍是旧模板长标题 |
| 2a | 简介·质量 | 读 README 凝练成摘要写进简介（提醒"为什么收藏"）；**不要**翻译 GitHub 平台本身的介绍 | 点"翻译"得到通用的"代码托管与协作平台…"，与项目无关 |
| 2b | 简介·同步 | 翻译/编辑后的简介应保存 | 保存后 App 里"详细介绍"仍为空 |

---

## 2. 数据流全景（先看懂链路，再看根因）

收藏有两条写入路径，都最终落到同一个 store：

```
[Chrome 扩展浮窗]  extension/src/content/floating-capture.ts
    openPanel: 初始标题/简介 = compactCaptureTitle(og:title) / og:description   ← 1a 在这
    enrichDraft: 调 background FETCH_META（共享 extractor，标题已正确取 repo 名）
                 → shouldReplaceCaptureTitle 决定是否覆盖                        ← 1a 也在这
    翻译按钮 translateDescription → localizeDescriptionText                      ← 2a 在这
    saveDraft: 把用户最终编辑的 title/description 存入队列（这一步是对的）
        │
        ▼
[队列 drain]  src/lib/floating-capture.ts  drainCaptureQueueItemsForWorkspace
    URL 已存在 → 跳过、不更新                                                    ← 1b + 2b 在这
        │
        ▼
[App 卡片]  已存在的卡片保持旧标题/空简介不变

[App 内编辑对话框]  src/components/dialogs/card-dialog.tsx（无翻译按钮，updateCard 正常，非本次问题源）
[App 自动抓取]      调 /api/fetch-meta（共享 extractor，同样已正确取 repo 名）
```

关键：**共享 extractor（`shared/metadata-extractor.js`）对 GitHub 已经能正确取 repo 名**（`repositoryTitleFromUrl`，53-63 行）。App 的"自动抓取"和扩展 background 的 FETCH_META 都用它，都是对的。问题出在**扩展浮窗自己的那套 `compactCaptureTitle`**（没有这条规则）以及**drain 的去重跳过**。

---

## 3. 四个根因（每个都用真实代码复现过）

### 根因 1a — 浮窗标题：内容脚本 `compactCaptureTitle` 无 GitHub repo 规则，且 `shouldReplaceCaptureTitle` 拒绝用正确 repo 名覆盖

- 文件：`extension/src/content/floating-capture.ts:881-898`（`compactCaptureTitle`）、`900-913`（`shouldReplaceCaptureTitle`）、`1189-1209`（`enrichDraft`）。
- 复现（真实函数原样跑）：
  - `compactCaptureTitle(og:title, "github.com")` → `"nexu-io/codex-slides: 🎨 Open-source..."`（与截图一致）。
  - background 抓回正确的 `"codex-slides"`，但 `shouldReplaceCaptureTitle(长标题, "codex-slides", draft)` = **false**（末条件要求"长标题以 repo 名开头"，而长标题以 `nexu-io/` 开头 → 不覆盖）。
- 结论：即使后台拿到了正确 repo 名，也覆盖不了浮窗里的长标题。

### 根因 1b + 2b — drain 对重复 URL"跳过不更新"（这是"改不对"的核心）

- 文件：`src/lib/floating-capture.ts:748-756`。
  ```ts
  const alreadyExists = cards.some((card) => normalizeCaptureUrl(card.url) === normalizedUrl);
  if (alreadyExists) {
    item.status = "imported";
    item.error = "Duplicate URL skipped";   // ← 静默跳过，现有卡片一字不改
    skipped += 1; changed = true; continue;
  }
  ```
- 复现（真实 `drainCaptureQueueItemsForWorkspace`）：已存在卡片(长标题+空简介) + 新草稿(title=`codex-slides`, 简介=用户翻译文本) → `imported=0, skipped=1`，卡片标题/简介**保持旧值不变**。
- 结论：用户在浮窗里改的任何标题/简介，只要该 URL 已收藏过，就永远不会落到卡片上。**这正是"老是改不对"的机制**——`saveDraft` 存的草稿是对的，但 drain 把它当重复丢了。

### 根因 2a — "翻译"对任意 github.com 页面返回硬编码通用摘要

- 文件：`src/lib/description-translation.ts:18`（DOMAIN_SUMMARIES 的 github 条目）、`123-131`（`summaryFromKnownSite`，优先级最高）。
- 复现（真实 `localizeDescriptionText`）：输入项目实际简介，url=`github.com/nexu-io/codex-slides` → 输出 `"代码托管与协作平台，用于管理项目、阅读代码和跟踪开发进度。"`。
- 结论：翻译对**具体 repo 页**也套用了 GitHub 平台级通用摘要，与项目无关。
- 注意：现有测试 `scripts/test-description-translation.ts:23-26` 断言的是 **github 首页** `https://github.com/` → 通用摘要，这是**正确**的，修复时必须保留（见 §4 Step 3）。

### 根因 2a-补 — 根本没有"读 README 凝练摘要"这个能力

- 现状：GitHub 页的简介来自 og:description（repo 的 About 一句话），或翻译时被通用摘要覆盖。**从未读取 README**。用户明确要的是 README 摘要。

---

## 4. 修复方案（按执行顺序；每步含验证）

> 全局规则：一步一个 commit；每步跑 `pnpm ts-check && pnpm lint && pnpm vitest run && pnpm build:ext` 全绿；绝不清空/重置用户数据。

### Step 1 — 【最高优先·修 1b+2b】drain 对重复 URL 改为"更新"而非"跳过"

这是"改不对"的根治，先做。

- 文件：`src/lib/floating-capture.ts`，`drainCaptureQueueItemsForWorkspace`（748-756 的 `alreadyExists` 分支）。
- 改法：命中重复时，**更新现有卡片的 title / shortDesc / fullDesc / imageUrl**，保留 `id / categoryId / order / note / abbreviation / createdAt`，`updatedAt` 刷新；仅当草稿字段非空才覆盖对应字段。
  ```ts
  const existingIndex = cards.findIndex((card) => normalizeCaptureUrl(card.url) === normalizedUrl);
  if (existingIndex >= 0) {
    const prev = cards[existingIndex];
    const draftDesc = item.draft.description?.trim() || "";
    const nextTitle = title;                       // 已 trim、已判空
    const nextImage = prev.imageUrl || item.draft.favicon || item.draft.imageUrl || prev.imageUrl;
    const updated = {
      ...prev,
      title: nextTitle || prev.title,
      shortDesc: draftDesc ? draftDesc.slice(0, 48) : prev.shortDesc,
      fullDesc: draftDesc || prev.fullDesc,
      imageUrl: nextImage,
      updatedAt: nextCaptureTimestamp(options),
    };
    const changedFields =
      updated.title !== prev.title || updated.shortDesc !== prev.shortDesc ||
      updated.fullDesc !== prev.fullDesc || updated.imageUrl !== prev.imageUrl;
    if (changedFields) { cards[existingIndex] = updated; changed = true; updated_count += 1; }
    item.status = "imported";
    item.error = changedFields ? undefined : "Duplicate URL unchanged";
    item.updatedAt = nextCaptureTimestamp(options);
    continue;
  }
  ```
- 结果对象加计数：在 `CaptureQueueDrainResult` 增 `updated: number` 字段并返回（`imported/skipped/failed` 保持）。`drainFloatingCaptureQueueUnsafe`（897-951）的返回类型同步加 `updated`，调用方按需展示。**持久化无需额外改动**：`drained.changed=true` 时既有的 `saveCardsRebased` 会写回更新后的卡片（已确认，928-940 行）。
- 安全：更新前无需额外快照（既有 rebase + 本地快照体系已覆盖）；但**只在草稿字段非空时覆盖**，避免把用户在 App 里精修的内容清空。
- 测试：`scripts/test-floating-capture-drain.ts` 增用例——已存在卡片 + 新草稿(改标题、改简介、带 note/abbreviation) → 断言 `title/fullDesc/shortDesc` 更新、`note/abbreviation/categoryId/order/id/createdAt` 保留、`updated=1 skipped=0`；再来一条完全相同的草稿 → 断言 `updated=0`（无谓写入不发生）。
- 验收（真机）：收藏过的 GitHub 页，浮窗改标题+简介保存 → 打开 App，卡片标题/简介已更新。

### Step 2 — 【修 1a】浮窗标题对 GitHub repo 直接取 repo 名

- 文件：`extension/src/content/floating-capture.ts`。
- 改法：
  1. 新增纯函数 `repositoryTitleFromCaptureUrl(url)`（镜像 `shared/metadata-extractor.js:53-63`，但**排除保留路径**避免误伤）：
     ```ts
     function repositoryTitleFromCaptureUrl(url: string): string {
       try {
         const p = new URL(url);
         if (p.hostname.replace(/^www\./i, "").toLowerCase() !== "github.com") return "";
         const seg = p.pathname.split("/").filter(Boolean);
         if (seg.length < 2) return "";                       // owner 主页/首页不取
         const reserved = new Set(["marketplace","topics","sponsors","settings","notifications","explore","search","orgs","apps","collections"]);
         if (reserved.has(seg[0].toLowerCase())) return "";
         return decodeURIComponent(seg[1]).replace(/\.git$/i, "");
       } catch { return ""; }
     }
     ```
  2. `compactCaptureTitle(text, fallback)` 增加 `url` 入参（或在调用处先判断）：**若 `repositoryTitleFromCaptureUrl(url)` 非空，直接返回它**（截断到 36）。三处调用点（1018、1034、1224）与 `enrichDraft`（1197）传入对应 url。
  3. 这样初始标题和抓取标题都成为 `codex-slides`，`shouldReplaceCaptureTitle` 不再需要为此放宽。
- 复用优先：若改动面担心，可只在 `compactCaptureTitle` 顶部加这条 repo 规则，其余逻辑不动。
- 测试：`scripts/test-floating-capture-metadata.ts` 增用例——`github.com/nexu-io/codex-slides` 的长 og:title → 浮窗初始标题 `codex-slides`；`github.com/nexu-io`（owner 主页）→ 不误取。
- 验收：GitHub repo 页打开浮窗，名称一开始就是 `codex-slides`。

### Step 3 — 【修 2a 之一】翻译不再对具体 repo 页套用通用摘要

- 文件：`src/lib/description-translation.ts`，`summaryFromKnownSite`（123-131）。
- 改法：github 域名摘要**仅对首页/owner 主页生效，不对 repo 页（路径 ≥2 段）生效**：
  ```ts
  function isGithubRepoPage(url?: string): boolean {
    try {
      const p = new URL(url || "");
      if (p.hostname.replace(/^www\./i, "").toLowerCase() !== "github.com") return false;
      return p.pathname.split("/").filter(Boolean).length >= 2;
    } catch { return false; }
  }
  // summaryFromKnownSite 内，命中 github 条目前先判断：
  //   if (item.domains.includes("github.com") && isGithubRepoPage(context.url)) continue;
  ```
- 保留现有测试：`test-description-translation.ts:23-26` 用的是 `https://github.com/`（首页，路径 0 段）→ 仍返回通用摘要，测试不变。
- 测试：增用例——repo 页 url + 英文简介 → **不**返回"代码托管与协作平台…"，而是走 README 摘要/软翻译。

### Step 4 — 【修 2a 之二·新能力】GitHub repo 读 README 凝练成摘要

- 新增共享模块 `shared/github-readme.js`（与既有 `shared/` 模式一致，供 App 路由和扩展 background 复用），导出：
  - `githubRepoFromUrl(url)` → `{ owner, repo } | null`（复用 Step 2 的保留路径规则）。
  - `githubReadmeCandidateUrls({owner,repo})` → 依次尝试：
    `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`、`.../HEAD/README.rst`、`.../HEAD/readme.md`、`.../HEAD/docs/README.md`（`HEAD` 在 raw 上解析为默认分支，已实测 200）。
  - `summarizeReadme(markdown, repoName)` → 提取第一段实质**散文**摘要（**已原型验证**，逻辑见下），截断到 ~220 字、按词边界收尾；提不出返回 `""`。
    - 跳过：标题行(`#`)、列表行、代码块(` ``` `)、图片/徽章/HTML 行、setext 分隔线、纯目录段（Table of Contents/Installation 等）。
    - 清洗：去徽章 `[![...](...)](...)`、图片 `![...](...)`、链接保留文字、markdown 记号、内联 HTML。
- 接入两处 fetch-meta 调用方（extractor 保持纯函数，不在里面联网）：
  - `extension/background.js` `handleFetchMeta`（129-149）：拿到 `metadata` 后，若 `githubRepoFromUrl(resolvedUrl)` 非空，则按候选 URL 顺序 `fetchExtensionRemoteText` 抓 README（同样走 `assertSafeRemoteUrl` 安全校验、`maxBytes`、超时），`summarizeReadme` 得到摘要；**摘要非空则覆盖 `metadata.description`**。失败静默回退原 description。
  - `src/app/api/fetch-meta/route.ts`：同样，抓到 HTML 后若是 repo，则用 `fetchRemoteText`（已有安全封装）抓 README 候选、`summarizeReadme`，非空则覆盖 `description`。
- 效果：浮窗 `enrichDraft` 与 App"自动抓取"拿到的 description 变为 README 摘要；`shouldReplaceCaptureDescription` 会用它替换初始 og:description。翻译按钮此时对英文摘要做软翻译（Step 3 已移除通用覆盖）。
- 网络/配额：只用 `raw.githubusercontent.com`（CDN，不受 api.github.com 60/时 限制），不加鉴权；非 GitHub 页零额外请求。
- 测试：新增 `scripts/test-github-readme.ts` —— 用内置 README 字符串样本（含徽章/图片/目录/代码块）断言 `summarizeReadme` 取到首段散文、跳过噪声、截断正确；`githubRepoFromUrl` 对 repo/owner主页/保留路径的判定。
- 中文化说明（诚实交代）：项目翻译是**本地规则**，非完整机器翻译（见 AGD）。README 英文摘要经软翻译得到的中文有限。本步先保证"简介=项目自身摘要（而非平台通用语）"，达到用户"看一眼想起为什么收藏"的目的；如需高质量中文摘要，另议接入浏览器翻译 API 或后端 MT，不在本次范围。

### Step 5 — 回归与发版

- 跑全套：`pnpm ts-check`、`pnpm lint`、`pnpm vitest run`、全部 `scripts/test-*.ts`、`pnpm build:ext`。
- 真机验收（用户现有主 Chrome profile，按 AGD 规则）：
  1. 新收藏一个没收过的 GitHub repo → 标题=repo 名、简介=README 摘要。
  2. 对**已收藏**的 repo 再收藏一次、改标题+简介 → App 卡片同步更新（核心验收）。
  3. 点翻译 → 不再出现"代码托管与协作平台…"通用语。
  4. 非 GitHub 页（如普通博客）行为不回归。
- 按当时最新功能版本号递增发版，走既有 CI/Release 流程。

---

## 5. 我已验证的证据（可复跑）

以下均在 `main`（V1.2.1）源码上用**真实模块**跑通：

1. `shared/metadata-extractor.js` 对 GitHub repo HTML → `title="codex-slides"`（共享路径本就正确）。
2. `extension/src/content/floating-capture.ts` 的 `compactCaptureTitle` 原样运行 → 初始标题 `"nexu-io/codex-slides: 🎨 Open-source..."`；`shouldReplaceCaptureTitle` → `false`（复现 1a）。
3. `src/lib/floating-capture.ts` 的 `drainCaptureQueueItemsForWorkspace`：已存在 URL → `skipped=1`，卡片标题/简介不变（复现 1b+2b）。
4. `src/lib/description-translation.ts` 的 `localizeDescriptionText`：repo url → 通用摘要（复现 2a）。
5. 修复原型：Step 1（更新而非跳过，保留 note/简称/分类）、Step 2（repo 名、不误伤 owner 主页）、Step 4（真实 + 合成 README 均提取出干净首段摘要）——全部断言通过。

---

## 6. 明确不要做的

- 不要保留"重复 URL 跳过"的旧行为（那正是 bug）；但也**不要**在草稿字段为空时覆盖已有卡片内容。
- 不要删除 `description-translation.ts` 的 github 条目（首页仍需要它，且有测试）；只对 repo 页短路。
- 不要在 `shared/metadata-extractor.js` 里发起网络请求（保持纯函数）；README 抓取放在两个调用方。
- 不要引入 `api.github.com` 鉴权/token；只用 `raw.githubusercontent.com`。
- 不要为了 README 摘要接入付费翻译服务（超范围，另行决策）。

## 7. 给执行者的一句话入口

> 读本文件 §4，从 Step 1（drain 更新而非跳过，修"改不对"核心）开始按序做，每步跑全套验证全绿再进下一步；§5 是我已复跑的证据，§6 是红线。
