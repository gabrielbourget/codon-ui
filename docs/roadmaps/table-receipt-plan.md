# Table Receipt Plan

## Purpose

This records the Amino UI-side plan for receiving Wavemap's reusable Table kit after the Wavemap-local support prep pass.

The target consumer experience is `add table`. Internal registry items may stay granular, but the consumer command should
install a coherent table-builder kit instead of exposing internal subgraph names.

## Current Read

Wavemap commit `1d41ec5d Move Table Filter Support Into Table Graph` prepared the source graph for receipt by moving
generic filter draft helpers and filter metadata into `src/components/Table`. The reusable Table and Filtering runtime
graph no longer needs app-wide `src/types`, app-wide `src/utils/filterDraft`, `listItemsGen`, `serverSideStyles` spacing
constants, or the `useBreakpoints` type import.

The source of truth for extraction boundaries remains Wavemap's
`apps/wavemap-docs/working-notes/COMPONENT_LIBRARY_EXTRACTION.md`.

## Public Shape

The public registry item should be `table`.

`add table` should install:

| Area                 | Expected content                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core table           | `Table`, `TableBody`, `TableCell`, `TableColumn`, `TableHeader`, `TableRow`, context, labels, helpers, query vocabulary, and CSS modules.                                                                                                                             |
| Filter support       | `TableFilterPopover`, `FilterClauseRow`, `DynamicFilterArgumentInput`, internal filter argument renderers, default icons, table filtering labels, draft helpers, and metadata.                                                                                        |
| Sort support         | Top-level `SortParameterList`, `SortParameterListItem`, default drag icon, helpers, and CSS modules.                                                                                                                                                                  |
| Child dependencies   | Existing and planned registry components used by the graph, including Button, Card, Checkbox, ClickPopover, ComboBox, DateTimePicker, FormField, Input, ListBoxItem, NumberInput, Pagination, Select, Switch, Tag, TagComboBox, Text, TimePicker, and ToggleSwitcher. |
| Support dependencies | Default theme CSS, action/control colors, a11y, geometry, theme order, motion, text typography, spacing, radius, focus, state, surface, shadow, transition, and opacity contracts already proven by earlier components where possible.                                |

Internal registry planning may split those areas into sub-items such as `table-core`, `table-filtering-support`,
`table-filter-draft`, `table-sort-parameter-list`, or equivalent names, but those names should not leak into the happy-path
consumer command.

## Candidate Source Files

The first receipt packet should list files under these Wavemap paths:

| Wavemap path                                                                    | Handling                                                                                                                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/wavemap-front-end/src/components/Table/**`                                | Receive as table-owned runtime, support, labels, styles, and query/filter vocabulary, excluding tests and stray local artifacts. |
| `apps/wavemap-front-end/src/components/Filtering/labels.ts`                     | Receive as table filtering label support unless labels are colocated under the Table package path during copy.                   |
| `apps/wavemap-front-end/src/components/Filtering/FilterClauseRow/**`            | Receive as reusable filter clause UI support, excluding focused tests from installable runtime files.                            |
| `apps/wavemap-front-end/src/components/Filtering/DynamicFilterArgumentInput/**` | Receive as reusable dynamic argument input support, excluding focused tests from installable runtime files.                      |
| `apps/wavemap-front-end/src/components/SortParameterList/**`                    | Receive as reusable sort-list UI support, excluding focused tests from installable runtime files.                                |

The packet should explicitly exclude `.DS_Store`, Wavemap focused tests, app showcase files, and app/query workflow files.

## Public Exports Draft

The package-facing public surface should be reviewed before source movement. The likely first pass should export:

| Export area | Candidate exports                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components  | `Table`, `TableBody`, `TableCell`, `TableColumn`, `TableHeader`, `TableRow`, `TableFilterPopover`, `FilterClauseRow`, `DynamicFilterArgumentInput`, and `SortParameterList` if those subcomponents are meant to be composed directly. |
| Labels      | Table labels and table filtering labels, plus partial-label types.                                                                                                                                                                    |
| Types       | `TableProps`, `TableColumnMetadata`, `TableQueryControls`, `TableSortInstruction`, `TableFilterGroup`, `TableFilterCriteria`, filter draft types, filter metadata types, and sort-list item/props types needed by consumers.          |

Keep calibration helpers, default icons, CSS-module internals, renderer-selection internals, registry sub-item names, and
local implementation helpers private unless a dedicated public API review widens them.

## Exclusions

The Table receipt must not move Wavemap-owned adapters by proximity.

| Excluded area                                            | Reason                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventTable`, `RecentEventsTable`, and `FileUploadTable` | Domain table adapters with event/upload row shapes, actions, media contracts, and product labels.                                                           |
| Upload and media workflows                               | Persisted media DTOs, object URL lifetime, MIME policy, upload state, image delivery, alt-text workflows, and Next image/runtime policy are consumer-owned. |
| Backend query execution                                  | API query mapping, `objectToQueryParams`, endpoint capabilities, API DTOs, and server/client fetch behavior remain Wavemap-owned adapters.                  |
| `SortAndFilterPanel` workflow source                     | Panel apply/cancel state, active chips, saved workflow state, i18n copy, and product interaction model are app/query workflow code.                         |
| Saved-view and route state                               | Preset import, auth/account state, route/query URL state, local guest persistence, and product copy stay local to Wavemap.                                  |
| Wavemap i18n adapters                                    | Registry source should expose labels; app-specific i18n adapters remain optional consumer code or future recipes.                                           |

## Import Rewrite Plan

The source receipt should rewrite Wavemap aliases to package-local paths:

| Wavemap import shape                        | Package direction                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `_registry/tokens`                          | Use package token modules such as `../../tokens/geometry`, `../../tokens/theme-order`, `../../tokens/a11y`, or split token imports as needed. |
| Child components under `@/src/components/*` | Use relative imports to package-local components already received into `packages/react/src/components`.                                       |
| `@/src/components/Table/*`                  | Use package-local Table-relative imports.                                                                                                     |
| `@/src/components/Filtering/*`              | Either preserve a package-local `Filtering` subdirectory as table support or relocate under `Table/filtering` with explicit import rewrites.  |
| `@/src/components/SortParameterList/*`      | Either preserve a package-local top-level component or relocate under `Table/sort` with explicit import rewrites.                             |

Do not add Wavemap alias support to Amino UI for this proof.

## Dependency Draft

Expected dependency pressure:

| Dependency kind       | Draft read                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Peer dependencies     | React, React DOM, and React Aria Components.                                                                                                                 |
| Runtime dependencies  | `classnames`, `motion`, and `@internationalized/date` if the package-local date/time picker graph does not already own that dependency before Table receipt. |
| Registry dependencies | Existing child components, default theme CSS, action colors, token support, text typography, and any additional theme support proven necessary by CSS scans. |
| Deferred dependencies | Backend query clients, Wavemap API contracts, Wavemap i18n, Next routing, Next image, upload/media packages, and generated token tooling.                    |

Add or change package dependencies only in the source-receipt implementation commit that proves the graph needs them.

## Verification Packet Draft

Before activating `table`, the source receipt should prove:

| Step              | Expected command or evidence                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source build      | `pnpm build:react`                                                                                                                                                                                  |
| Package checks    | `pnpm -F @amino-ui/react format:check`, `pnpm -F @amino-ui/react lint`, `pnpm -F @amino-ui/react stylelint`, `pnpm -F @amino-ui/react typecheck`, and registry contract checks if manifests change. |
| Forbidden imports | Scan received Table, Filtering, and SortParameterList source for Wavemap path aliases, `@wavemap/*`, media/upload DTOs, saved-view code, route state, and app query execution helpers.              |
| Public exports    | Typecheck package-facing exports for the approved components, labels, and types.                                                                                                                    |
| Runtime graph     | Confirm no `EventTable`, `FileUploadTable`, `SortAndFilterPanel`, saved-view coordinator, upload/media workflow, app showcase, or Wavemap i18n adapter source is copied.                            |

After activation, fixture evidence should prove `add table` installs a local app-owned table with rows, columns, sorting,
filtering, selection, empty/loading states, and pagination without copying Wavemap adapters. Wavemap proof should then
delete the local Table receipt paths and relevant lock ownership entries, run the public `add table` path, and re-run the
focused Table and query-control verification from the source app.

## Stop Conditions

Return to planning before source movement if the next pass requires:

- New registry item naming that exposes internal subgraphs to consumers instead of `add table`.
- Moving `EventTable`, `FileUploadTable`, media/upload workflows, saved views, app query execution, route state, or Wavemap
  i18n adapters.
- Adding package dependencies that are not proven by the received source graph.
- Implementing CLI update, diff, status, delete, eject, package publication, hosted registry behavior, generated token
  writers, or registry builder rewrites.
- Broad theme contract expansion instead of direct `--aui-*` rewrites or existing narrow support contracts.
- Copying focused Wavemap tests into installable runtime source.
