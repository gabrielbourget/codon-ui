---
title: Consumer Proofs
description: Mature consumer reinstall evidence and adapter preservation rules.
---

Consumer proofs show that registry source can leave Amino UI, land in a real app, and remain understandable after
installation. Fixtures prove small command contracts. Wavemap proves the registry graph against a mature consumer with
existing adapters, aliases, tests, and local source history.

## Wavemap's Role

Wavemap is the mature local consumer for the extracted graph. Its proof job is narrow:

- delete only files that Amino UI registry metadata owns;
- rehydrate those files through the local CLI and registry snapshot;
- keep Wavemap-owned adapters and product workflows in Wavemap;
- verify the app after reinstall;
- inspect `amino-ui.lock.json` for provenance, dependencies, and ownership state.

A Wavemap reinstall proof does not make Wavemap app code part of Amino UI. It proves that the boundary is enforceable in
a real consumer.

## Reinstall Loop

Use this loop after source receipt, manifest activation, local snapshot refresh, and fixture evidence are already green:

1. Choose a registry item whose source and registry dependencies are active in `packages/react/src/registry/manifest.ts`.
2. Confirm the fixture repo proves advisory, dry-run, strict add, lockfile metadata, and compile behavior for that item or
   its command family.
3. In Wavemap, list the approved registry-owned files and the consumer-owned files that must stay local.
4. Delete only the approved registry-owned runtime, style, support, or theme files from the consumer.
5. Run the local CLI add command against the Wavemap front-end, for example:

   ```sh
   node ../amino-ui/packages/CLI/dist/index.js add sort-and-filter-panel --json --cwd apps/wavemap-front-end
   ```

6. Inspect `apps/wavemap-front-end/amino-ui.lock.json` for installed items, registry dependencies, file hashes,
   dependency decisions, and reused support files.
7. Run focused Wavemap tests for the reinstalled surface and its local adapters.
8. Run front-end format, lint, typecheck, boundary scans, source comparison when useful, and Wavemap roadmap/tooling
   checks.

## Proof Packet

Each mature-consumer proof should leave a short packet in the branch history or working note:

| Packet field       | What to record                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Registry item      | Public item id and any internal registry dependencies reused during install.                                    |
| Deleted files      | Exact consumer files removed before rehydration.                                                                |
| Preserved adapters | Local files intentionally not moved or overwritten.                                                             |
| CLI invocation     | Command, flags, cwd, and registry source when relevant.                                                         |
| Lockfile result    | Installed item ids, ownership states, file count, dependency decisions, and reused support files.               |
| Boundary evidence  | Import scans or source comparisons proving Wavemap-only APIs, routes, translations, and providers stayed local. |
| Verification       | Focused tests, front-end checks, docs/tooling checks, and any skipped checks with reason.                       |

## Adapter Preservation

These Wavemap surfaces stay consumer-owned by default:

- API contracts, endpoint DTOs, and backend query shapes;
- route/query state, URL serialization, and page state;
- saved views, local persistence, and product presets;
- app translations, labels, and providers;
- media upload, gallery, storage, and preview workflows;
- product/domain tables that compose reusable table pieces with Wavemap data contracts.

If a future pass wants to promote one of those surfaces, it needs a named reusable contract and a separate source-receipt
plan. It should not travel because it is adjacent to a registry-owned component.

## Lockfile Review

`amino-ui.lock.json` is the consumer proof ledger. After reinstall, review:

- registry item names and installed source paths;
- source and installed hashes for each file;
- registry dependency reuse;
- dependency decisions and whether each required package was already satisfied;
- ownership states such as `registry-owned`, `locally-modified`, `consumer-owned-support`, `unknown`, or `ejected`.

Later lifecycle commands must preserve locally modified, consumer-owned-support, unknown, and ejected files by default.

## When To Stop

Stop before a Wavemap proof becomes broader than the approved registry item. A reinstall pass should not add public
registry hosting, package publication, generated token writers, package-manager dependency writes, strict update/eject
behavior, or Waveguide validation unless those lanes have been explicitly opened.
