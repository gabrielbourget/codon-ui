# AGENTS.md

## Purpose

This document defines working guidelines for AI agents operating in the Amino UI monorepo.

Amino UI is being renovated into the canonical component-library and registry source for reusable UI that can later be
distributed back into Wavemap, Waveguide, and other consumer repos. Agents should prioritize small, high-confidence
changes that preserve the current renovation sequence.

If a change would:

- Add or upgrade dependencies.
- Change TypeScript, package-manager, build, lint, or formatting tooling.
- Modify CI/CD, deployment, release, or package publication behavior.
- Introduce new cross-package APIs.
- Change registry artifact shape, CLI install/update/diff behavior, or public theme contracts.
- Move Wavemap component source into this repo.
- Refactor broadly across unrelated packages.

Then propose a plan first instead of implementing immediately.

## Repo Overview

Amino UI is a `pnpm` workspace with separate package ownership boundaries:

- `apps/web` owns the web app and current registry artifact builder surface.
- `packages/CLI` owns the current CLI package, published as `aminoui-cli`.
- `packages/shared-utils` owns shared ESLint, Prettier, Stylelint, and TypeScript presets.
- `packages/react` owns the private `@amino-ui/react` React source receiver package and its package CSS entrypoint.

Treat sibling repos as separate git repositories. Do not edit Wavemap or another repo as incidental cleanup during an
Amino UI pass. When component-library extraction roadmap updates are needed, use Wavemap's
`apps/wavemap-docs/working-notes/COMPONENT_LIBRARY_EXTRACTION.md` deliberately and verify Wavemap with its own commands.

## Operating Modes

Agents should work in one of two modes: Deliberate Collaboration Mode or Agentic Execution Mode. Deliberate Collaboration
Mode is the default unless the repository owner explicitly opens a bounded Agentic Execution Mode run.

### Deliberate Collaboration Mode

Use Deliberate Collaboration Mode when the goal, architecture, component API, risk profile, or educational value is still
forming.

In this mode, agents should:

- Read the relevant files before proposing changes.
- Explain findings, tradeoffs, and likely scope before editing consequential surfaces.
- Prefer one logical commit-sized change at a time.
- Keep diffs small enough for the repository owner to understand without reconstructing hidden reasoning.
- Ask before making changes that alter repo conventions, package boundaries, registry contracts, CLI behavior,
  dependencies, CI/CD, deployment, publication, or public APIs.
- Surface alternatives when a decision may spread into future components, packages, docs, registry artifacts, or consumer
  repos.

Use Deliberate Collaboration Mode for:

- New architecture, package boundary, registry, CLI, release, or repository workflow decisions.
- Dependency, package-manager, TypeScript, lint, formatting, build-tool, Docker, CI/CD, or publication changes.
- Cross-package APIs or promotion from app-local code into shared packages.
- Component-library API decisions while prop names, ownership, styling contracts, or extraction boundaries are still being
  decided.
- Theme/default CSS contracts that affect downstream consumers.

### Agentic Execution Mode

Agentic Execution Mode is opt-in. Use it for faster implementation after scope, direction, and expected content are clear,
the blast radius is bounded, and verification steps are known.

In this mode, agents may:

- Implement a short chain of small, logical changes without pausing after every local edit.
- Run targeted verification after each meaningful step.
- Prepare and create multiple reviewable commits when the run includes explicit commit permission.
- Continue through routine mechanical work that follows established Amino UI patterns.

Agents must still:

- Keep each commit coherent, narrow, and independently explainable.
- Commit at natural review boundaries instead of accumulating one broad uncommitted diff.
- Stop and return to Deliberate Collaboration Mode when new architectural, registry, CLI, publication, security,
  deployment, ownership, or public API risk appears.
- Avoid broad opportunistic refactors.
- Preserve unrelated user or maintainer changes.
- Avoid generated commit trailers, co-author lines, AI attribution, or unusual metadata unless explicitly requested.
- Use the local Git identity configured in the repository when asked to commit.

### Agentic Commit Cadence

When the repository owner authorizes Agentic Execution Mode, clarify the expected commit cadence before beginning
consequential work. If the owner delegates a bounded commit run, commit as work is completed. Each commit should represent
one coherent repository step.

If commit permission is not included, work may still proceed after approval, but pause at natural commit boundaries and
report the proposed split before committing.

## Component Extraction Guardrails

Do not move `Switch` or any other Wavemap component source into Amino UI until the target repo can express source
ownership, theme CSS load order, registry artifact policy, peer/runtime policy, and focused tests.

During foundation passes:

- Do not add React Aria or other runtime dependencies until the first received component needs them.
- Do not add generated token writers or CLI palette generation.
- Do not implement CLI install, update, diff, status, or ejection behavior as incidental cleanup.
- Do not decide package publication, release automation, or deploy workflows casually.
- Do not treat legacy shadcn-derived scaffolding as authoritative.
- Do not make broad registry behavior changes without an approved pass.
- Keep `@amino-ui/react/theme.css` hand-authored until generated-token policy is explicitly chosen.
- Keep canonical source ownership separate from generated registry artifacts.

If package boundary, theme contract, registry artifact shape, CLI behavior, peer/runtime policy, or publication questions
appear, return to deliberate planning mode.

## Tooling

- Package manager: `pnpm`.
- Root verification uses ordered scripts:
  - `pnpm check`
  - `pnpm build:react`
  - `pnpm build:cli`
- Root checks use `pnpm -r` scripts where practical. Do not reopen a Turbo migration casually.
- Prefer workspace-scoped commands for focused checks, such as `pnpm -F @amino-ui/react build`.
- If scripts differ, inspect `package.json` before guessing.

## Workflow Rules

1. Prefer the smallest viable change that solves the issue.
2. Keep changes localized to the package or app that owns the behavior.
3. Avoid drive-by formatting unrelated to the task.
4. If a change crosses packages, explain why that boundary crossing is necessary.
5. Update or add tests for behavioral changes.
6. Do not introduce new architectural patterns unless asked; follow existing patterns first.
7. Treat generated artifacts carefully. Regenerate them through scripts instead of editing them by hand unless explicitly
   instructed.

Work in Deliberate Collaboration Mode by default. Do not independently edit files, run write commands, apply patches, or
create commits unless asked to or operating inside an explicitly authorized Agentic Execution Mode run.

## TypeScript And Code Style

Follow the shared presets in `packages/shared-utils`.

General preferences:

- Prefer double quotes.
- Prefer arrow functions over `function` declarations.
- Avoid alignment padding for assignments.
- Favor verbose, self-documenting names.
- Use comments sparingly and focus them on intent, boundaries, non-obvious behavior, and why a helper exists.
- Do not use semicolons at the end of expressions unless JavaScript parsing requires one.
- Prefer types named `T...`.
- For string unions, prefer constants plus `as const` arrays plus derived union types.

## Styling Conventions

- CSS custom properties owned by Amino UI should use the `--aui-` prefix.
- Keep default theme variables narrow until real component source proves that more variables are needed.
- Prefer semantic component-system roles such as foreground, background, surface, border, control, status, focus, spacing,
  radius, shadow, transition, and opacity before product-specific color decisions.
- Do not promote Wavemap app chrome, gradients, route layout constants, map colors, or product typography into the default
  Amino UI theme without an explicit contract pass.

## Testing And Verification

Prefer the narrowest verification command that exercises the touched behavior.

For Amino UI implementation work, normally run:

- `pnpm check`
- A focused package build when relevant, such as `pnpm build:react` or `pnpm build:cli`.
- `git diff --check`

For Wavemap roadmap updates, verify in the Wavemap repo with:

- `pnpm -C apps/wavemap-docs format:check`
- `git diff --check`
- `pnpm verify:github-actions`
- `pnpm verify:tooling`

If a verification command is too expensive, unavailable, or blocked by local environment constraints, say so clearly.

## What Done Looks Like

A task is complete when:

- The change is correctly scoped and explained.
- Relevant tests or checks have run, or skipped checks are called out.
- The worktree state is understood.
- Roadmap notes are updated when a roadmap item has meaningfully changed.
- The next stop condition or decision point is clear.
