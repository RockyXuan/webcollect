# Floating Capture Widget Plan

## Success Criteria

1. Ordinary `http` and `https` pages show a small WebCollect capture entry when the extension is enabled.
2. A user can capture a hovered link, a URL inside selected text, the current page, or a right-click target.
3. Capture drafts contain title, URL, optional description, source metadata, and an optional destination tree selection.
4. Content scripts never write WebCollect IndexedDB directly. They only enqueue drafts in `chrome.storage.local`.
5. The WebCollect new tab drains pending queue items through the existing `addCard` path, so local save and existing cloud sync still own persistence.
6. If the destination cache is missing or stale, the card falls back to the current section/homepage `收集箱`.

## Architecture

- `extension/src/content/floating-capture.ts`
  - Plain TypeScript DOM UI injected as a content script.
  - Own shadow-root CSS to avoid page style collisions.
  - Reads local floating widget preferences and destination cache through background messages.
  - Saves validated drafts to the background queue.

- `extension/background.js`
  - Keeps the MV3 service worker as pure JavaScript.
  - Adds context-menu capture, local preferences, destination-cache reads, and queue writes.
  - Reuses existing `FETCH_META` to enrich title/description/favicon.

- `src/lib/floating-capture.ts`
  - Shared extension-side queue types and new-tab drain logic.
  - Publishes a lightweight destination cache from current sections/categories.
  - Drains pending items into normal `WebCard` records with duplicate URL skipping.

- `extension/src/newtab-app.tsx`
  - Publishes destination cache after data load and section/category changes.
  - Drains the capture queue on startup, focus, and queue update messages.

- `src/components/auth/user-menu.tsx`
  - Adds local-only floating widget settings under the account menu.

## Non-Goals

- Do not change the cloud sync merge algorithm.
- Do not change drag, resize, or wall layout behavior.
- Do not cloud-sync floating widget preferences in the first version.
- Do not inject into restricted browser pages such as `chrome://` or Chrome Web Store pages.

## Validation

- Static: `corepack pnpm ts-check`, `corepack pnpm lint`, `corepack pnpm build:ext`.
- Manual smoke after loading `extension/dist`:
  - Open GitHub or another normal site and confirm the right-side capture button appears.
  - Hover a real link and confirm the mini capture button opens a prefilled form.
  - Select text containing a URL and capture it.
  - Use the context menu on a link.
  - Open WebCollect and confirm pending captures land in the selected destination or fallback inbox.
