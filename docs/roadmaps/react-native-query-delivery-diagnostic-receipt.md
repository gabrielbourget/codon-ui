# Native Query Delivery — Frozen Fixture And Blocked Transport Receipt

Status: **Pass 1 complete; pass 2 stopped at the single transport preflight; text-delivery attribution indeterminate**. Gabriel approved the [bounded diagnostic](react-native-query-delivery-diagnostic-pass.md) and logical commits on 2026-10-16. Commit `65817c3233412d2126945542f43c62e8d2b44170` freezes the private matched fixture and coverage audit. No production component, controlled-value behavior, dependency pin, palette, public API or signing configuration changes in this diagnostic.

## Frozen Source And Runtime

The [private fixture](examples/native-query-delivery/README.md) contains separate controlled raw TextInput, Codon Input and ComboBox cases, a matched async-result workload and ref-only heartbeat/event observations. A transport action touches no editor. Focused typing verdicts must be preserved before Close/export; post-blur text cannot repair them. The fixture's compact observation metadata and added instrumentation differ from the original failed fixture, so even a later success would not be a byte-identical replay or close RN-TEXT-01.

Four focused fixture cases, ESNext/no-DOM strict types, shared lint and formatting pass. The heartbeat case requires an initial React Profiler commit and no further commits during its timer-only interval. The normal first-commit root hook passes pnpm check. These are source/instrumentation checks, not native typing acceptance.

The fresh consumer `/private/tmp/codon-query-delivery-20261016` retains the prior manifest, lock, Intl/bootstrap and package archive byte for byte, without a workspace/sibling runtime source link. All 62 production sources and the palette remain unchanged. Exact runtime pins remain Expo 57.0.26, React 19.2.3, RN 0.86.3 and safe-area 5.7.0. CocoaPods deployment linking passes after a verified consumer-path-only ExpoModulesCore checksum adjustment; the initial checksum-helper error is retained separately from native test results. Both Metro exports and the embedded unsigned iOS Release map match 56 archived runtime sources and three current app/bootstrap sources. All 67 built app files match the installed app; the complete built app is preserved.

| Identity                   | SHA-256 / value                                                                |
| -------------------------- | ------------------------------------------------------------------------------ |
| Runtime producer           | `878a12d07721563e5c15963af5b6863a3cff27bf`                                     |
| Fixture producer           | `65817c3233412d2126945542f43c62e8d2b44170`                                     |
| Archive                    | `2b31ed8025c4260bb8c0781fc3632f7fb9f62a0f6643197852cb8eda61d8cfa4`             |
| Consumer lock              | `f49c4748936ab5bf0d326d66763a533dec65191e90f883c5bb22d8cdb017c573`             |
| Palette                    | `9ca00a7fe4f741c2ea48dfb543aae135c9ac8288619825a3ef754ca877dfb71a`             |
| iOS Release executable     | `2df58c5218c2ac566d90319dcea5318631f9ba860825182b2cee5cb1f6ccf3d1`             |
| iOS embedded Hermes bundle | `7394c3e28e930aa20f16ba9a5c140b5f51a93f9828bd7d100757a55b4c2cf037`             |
| Retained guest             | `1A58D819-F5D5-43D6-B7A0-C9B57F9D5C77`; iPhone 16e / iOS 26.5 `23F77` / x86_64 |

The installed-identity receipt's legacy trialSourceCommit field names the repository HEAD before the fixture commit. The pass-1 freeze separately binds the actual fixture file hashes to `65817c3`; the package producer remains `878a12d`. Treat those as distinct ownership identities.

## Single Preflight And Stop

The retained guest is booted and its explicit Simulator window is opened before readiness. The inspector builds successfully. One test-without-building invocation selects only testTransportPreflight. xcodebuild announces the result-bundle path but emits no test-method execution or completed verdict. After 90 seconds without log progress, the watchdog checks for the exact guest's test runner meeting its active-process extension criterion, finds no qualifying runner and interrupts the task-owned process group. The outer driver ends after 102.19 seconds. A later process snapshot contains no xcodebuild or matching test runner; this does not reconstruct the runner's earlier state or identify the bootstrap cause.

Attachment export exits 64 because the partial diagnostic-preflight.xcresult has no Info.plist. No completed preflight summary, callback observation, screenshot or typing trace is available. Preserve the interrupted log, export failure, partial result bundle and frozen inspector source/compiled identity. This is an incomplete transport preflight, not a failed component assertion and not evidence of a JavaScript/input stall.

Apply the approved stop condition: **one preflight attempt; zero component attempts**. Raw, Input, ComboBox and the conditional warm repeat are not launched. No native debugger snapshot, guest cycling, alternate keyboard settings, production repair or global setup change follows. The recorded large content size is restored, the guest is stopped and no task-owned test process remains. The preflight does not establish any new orientation or physical-device acceptance; iPhone signing and ARM review remain deferred. Android native execution is not part of this diagnostic.

## Coverage Baseline And Next Decision

The [web/native coverage audit](react-native-searchable-selection-coverage.md) makes the canonical web contracts the minimum verification baseline for the native family, with native runtime/accessibility/keyboard/window evidence added. Current native suites cover ownership, async replacement, guards, refs and several customization outcomes, but direct ComboBox geometry, sizes, focus toggles, isolated validation/color propagation, button-slot/default-icon and root-prop ownership assertions still need focused work. Test counts and fixture checks do not establish parity. Deferred capabilities retain explicit dispositions rather than disappearing from the catalogue.

RN-TEXT-01 remains open. The original N-only focused ComboBox failure, earlier complete-native-text/Na-until-blur signature and older raw corruption are neither reproduced nor explained by this run. First result activation, keyboard-active Close/Back, nested draft/context/theme retention, the maintained scene and expanded layout/removal acceptance remain blocked at their existing gates. No library migration or Codon synchronization workaround is justified by this preflight failure.

The next runtime decision is a separately bounded investigation of the preserved XCTest startup/transport failure, followed by the already frozen comparison only after transport is proven. Keep any proposed recovery limited to this task's guest/runner and exact artifacts; do not reopen dependency/toolchain settings or cycle guests as an implicit retry. A separate focused component contract pass should close the coverage audit's supported customization assertions. Neither next step is automatically started by this receipt.

## Evidence And Verification Tier

The private packet is `/Users/gabrielbourget/.codex/visualizations/2026/10/16/01a142c2-0db7-7d31-aa1f-53e3773a7870/native-query-delivery-diagnostic-2026-10-16`. It contains the accepted fixture/configs, archive, graph and full-app identities, complete unsigned app, build/source gates, frozen inspector inputs, interrupted preflight, partial result bundle, cleanup and handoff records. The previous first-query failure packet remains separate and sealed. All 5,379 manifest-listed files in the six inherited handoff seals match. Two unlisted bytecode files in the controlled-text packet predate its seal and remain untouched; the custody audit records them explicitly. No inherited sealed helper is executed/imported. Seal this new packet after the receipt commit.

The verification tier is focused fixture tests/types/lint/format plus frozen Metro/embedded graphs, unsigned iOS Release build and full installed-app parity. Documentation formatting/build, the receipt's normal root commit hook and git diff --check complete the closeout. Broad native source suites are not repeated because no production source changes after their prior checkpoint. Native component acceptance remains unavailable because transport preflight does not finish.

## Authorized Transport Investigation — 2026-10-16

The subsequent [bounded investigation receipt](react-native-xctest-preflight-recovery-receipt.md) retains this frozen app/inspector/fixture and makes two new incomplete preflight attempts. Session initiation completes, but runner installation waits for a CoreSimulator bridge reply even after one guest-only installer restart. A later installer sample shows framework enumeration, leaving slow initialization versus a stuck installation unresolved and exposing the runner-only liveness limitation. No component comparison runs. This earlier packet and verdict remain sealed separately.
