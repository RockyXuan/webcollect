# WebCollect V1.3.1 header design QA

- Source visual truth: `/var/folders/r6/d87b2sn907z9rzkm9fvvkm680000gn/T/codex-clipboard-c4be7be0-95d9-4c9e-9f77-4f71c31b118d.png`
- Implementation: `http://127.0.0.1:5014/`
- Primary implementation screenshot: `/private/tmp/webcollect-v1.3.1-header-after-2048x1152.png`
- Focused comparison: `/private/tmp/webcollect-v1.3.1-header-comparison-2048.png`
- Responsive evidence: `/private/tmp/webcollect-v1.3.1-header-after-1366x768.png`, `/private/tmp/webcollect-v1.3.1-header-after-390x844-final.png`
- Primary viewport: `2048 x 1152`; additional viewports: `1366 x 768`, `390 x 844`
- State: collection open in mindmap mode, light theme, logged out in the isolated in-app Browser

## Findings

No actionable P0, P1, or P2 finding remains.

- P3 evidence limit: the isolated Browser was logged out, so the real signed-in sync badge was not available in the screenshot. Success, syncing, and error tone placement is covered by the component test and the responsive test's real badge geometry fixture; final signed-in Chrome verification remains part of the release gate.

## Fidelity review

- Fonts and typography: existing WebCollect font families and copy are unchanged. Default engine and toolbar labels now share neutral slate foregrounds; primary, selected, focus, and hover states retain blue emphasis without making ordinary labels blue.
- Spacing and layout rhythm: standard desktop toolbar surfaces are `38px` high with `14px` radii and matched padding. At `390px`, visible toolbar, wallpaper, mode, and login surfaces are all `36px`; document overflow is zero.
- Colors and tokens: ordinary actions, sync status, wallpaper, login, warehouse, recycle bin, and mode containers share the same translucent white background, neutral border, and shadow. Sync colors are limited to status icons. The add-page button remains the single blue primary action.
- Image quality and assets: no image, mascot, favicon, avatar, or icon asset was added, replaced, cropped, or regenerated. Existing Lucide and product assets remain unchanged.
- Copy and content: Google / 百度 / Bing, action labels, sync wording, and mode labels are unchanged.
- Icons and affordances: icon sizes and alignment remain intact. Hover and focus feedback remain visible, while quiet actions no longer lose their clickable surface.
- Responsiveness: the existing two-row `1181-1799px` layout is preserved. Automated checks cover `2048`, `1800`, `1728`, `1536`, `1440`, `1366`, `1280`, `1024`, and `390px` widths.
- Accessibility: semantic buttons, the native search-engine select, mode `aria-pressed`, the wallpaper switch, titles, and keyboard focus behavior are preserved. No new motion or reduced-motion behavior was introduced.

## Comparison history

### Iteration 1

- P2: standard actions were `44px`, mode was `38px`, login was about `31px`, and the surfaces used different radii and borders.
- P2: Google used a blue default foreground while adjacent search text was neutral.
- P2: recycle bin and warehouse were transparent while neighboring actions were framed.
- Fix: unified desktop control height, radius, neutral foreground, translucent background, border, shadow, and padding; retained blue only for primary/selected/interaction states.
- Evidence: the `2048px` focused comparison shows the resulting compact, consistent toolbar.

### Iteration 2

- P2: the first mobile pass left the view-mode container at `38px` while the other visible controls were `36px`.
- Fix: added the compact mode-container and mode-button dimensions at the mobile breakpoint.
- Post-fix evidence: the final `390 x 844` capture and browser metrics show all visible control families at `36px`, with `scrollWidth === innerWidth`.

## Browser verification

- Page identity: `WebCollect | 个人网页收藏墙` at `http://127.0.0.1:5014/`.
- Page rendered with no framework error overlay or blank state.
- Primary interaction: mindmap -> classic -> mindmap; one shared header remained mounted and the expected collection surface changed each time.
- Console: zero relevant warnings or errors.

## Implementation checklist

- [x] Neutralize the default search-engine foreground.
- [x] Unify ordinary action, status, wallpaper, login, and mode surfaces.
- [x] Reduce standard desktop actions to `38px` while preserving the primary CTA.
- [x] Keep Web and extension CSS declarations identical.
- [x] Verify desktop intermediate-width separation and compact mobile layout.
- [x] Preserve all business behavior and storage contracts.

final result: passed
