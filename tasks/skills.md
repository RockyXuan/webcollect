# WebCollect Coding Skills

These rules are the default working frame for non-trivial WebCollect changes. They favor caution over speed because this project stores personal user data.

## 1. Think Before Coding

- State assumptions before implementation.
- If a request has multiple meanings, clarify or present the options.
- If a simpler approach exists, say so.
- If something is unclear, stop and ask instead of hiding confusion.

## 2. Prefer Simplicity

- Solve the requested problem with the least code that is still correct.
- Do not add features, abstractions, configurability, or speculative error handling that were not requested.
- If a solution grows much larger than the problem requires, simplify it before shipping.

## 3. Edit Precisely

- Only touch files and lines that directly support the user request.
- Do not refactor unrelated code.
- Match existing project style.
- Remove only dead code created by the current change.
- Every changed line should be traceable to the request.

## 4. Define Success Before Work

For non-trivial work, write a short checklist in `tasks/todo.md` before implementation:

```md
- [ ] Step -> Verification: command or behavior check
- [ ] Step -> Verification: command or behavior check
- [ ] Step -> Verification: command or behavior check
```

Good success criteria are concrete:

- Bug fix -> reproduce the bug or identify the failing path, then verify the fixed path.
- Sync/storage change -> verify the full data scope and build the extension.
- UI change -> verify layout and interaction states.

## 5. Default Workflow

For tasks with more than three steps, architecture choices, sync/storage logic, or user-data risk:

1. Read `AGENTS.md`, this file, and `tasks/lessons.md`.
2. Write a short plan in `tasks/todo.md`.
3. Confirm the plan with the user unless the request is urgent or explicitly asks to continue.
4. Implement one scoped step at a time.
5. Mark completed checklist items as they are done.
6. Run the relevant verification commands.
7. Add a short review section to `tasks/todo.md`.
8. If the user corrects a mistake, add a lesson to `tasks/lessons.md`.

## 6. Verification Is Required

Do not call a task complete until it has been proven with facts:

- `corepack pnpm ts-check` for TypeScript changes.
- `corepack pnpm lint` for code quality.
- `corepack pnpm build:ext` for Chrome extension changes.
- Browser or extension checks for visible UI and interaction changes when available.

If a command cannot be run, record why in the final response.

## 7. WebCollect Data Safety

Sync and storage changes must account for the full user-owned data model:

- collection sections
- parent categories
- child groups
- web cards
- recycle bin
- warehouse categories
- warehouse cards
- warehouse import batches
- hidden recommendations
- pinned categories
- layout widths
- visual scale

Never delete, reset, or overwrite user data unless the user explicitly asked for that exact operation.

## 8. Elegant Enough

Before shipping non-trivial code, ask:

- Is this the smallest correct design?
- Will it avoid the same bug class next time?
- Would a senior engineer accept the tradeoff?

If the fix feels like a patch on symptoms, revisit the root cause.
