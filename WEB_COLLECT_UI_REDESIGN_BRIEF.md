# WebCollect Blue Glass UI Redesign Brief

## Scope

Rebuild the WebCollect visual layer into a blue-purple, glassmorphism, Apple-like dashboard while preserving the existing data model, sync logic, import logic, warehouse logic, drag IDs, and store methods.

## Non-Negotiables

- Do not delete, rename, rewrite, or reseed user data.
- Do not change Supabase sync merge behavior, IndexedDB schemas, warehouse persistence, or import parsing.
- Keep drag, edit, add, delete, recycle bin, warehouse, floating capture, and version rollback entry points wired to the existing functions.
- Any visual change must be reversible without affecting the user's saved categories, groups, cards, sections, recycle bin, or warehouse.

## Visual Direction

- Background: soft blue-white canvas with subtle radial blue and violet light.
- Surfaces: translucent white glass, soft border, high blur, large radius.
- Primary actions: blue-to-violet gradient, restrained glow, no orange dominance.
- Content cards: large section panels, softer subgroup cards, lightweight site tiles.
- Header: logo mark, search pill, sync status, refresh, primary add button, secondary tools, avatar.
- Account menu: right-side settings panel with backdrop blur instead of a compact dropdown.
- Add website dialog: two-column modal with a visual helper panel and focused form.

## Validation

- UI-only diff should not touch sync/database/import code.
- App must typecheck and extension build must pass.
- Manual visual check should include the home dashboard, add dialog, account panel, and recommendation area.
