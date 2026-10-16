# Native Controlled Text — Isolation Receipt

Status: **Pass 1 complete; reduced-fixture pass 2 pending**. Gabriel approved the [two-pass scope](react-native-controlled-text-sequence-pass.md) and logical commits on 2026-10-15. Production Input, overlay transport, public defaults, dependency pins and palette remain unchanged. Shared TypeScript and controlled values remain required; iPhone signing and physical acceptance stay deferred.

## Pass 1 — Independent Paired Consumer

The fresh consumer uses the immutable Codon archive from source `13f267c21e125f7d0ca03132bdeed7e0667a7ea8`, SHA-256 `3895f79a424093d7ced21e726d9f7e6753f15251b2951ac1835d05c548e7d89b`. Expo 57.0.26, React 19.2.3, React Native 0.86.3, safe-area 5.7.0, existing app-only Intl initialization and the compatible development DOM peer stay pinned. A fresh frozen install disables scripts and preserves the release-age policy. Removing the previous primitive experiment reduces the lock from 830 to 782 records, with no added or upgraded package versions. The consumer lock hash is `1ca6ed339283d713b9a9cc408d5d8cb1f0dcd5c641f055676a2d574fa9856479`.

The native Pod versions also stay unchanged. The only Podfile.lock delta is ExpoModulesCore’s checksum: its generated spec contains the new consumer’s absolute local tarball path; normalizing that path makes the specs identical.

All 54 production source files match the archive and installed package. The iOS/Android production exports and actual embedded iOS map each match 48 archive sources and the three actual fixture/bootstrap files. The diagnostic runtime contains no RN Primitives, Zustand, Radix, DOM or React Native Web code. The paired Release executable hash is `61e056ef409c4fe0ee458ccae96453f1324722f571bf8f007add48a48f8ee30b`; its embedded bundle hash is `bd3c6edcc0a069f5ec91d8ab915d9c92cde4254b6e77d62136ce4a3034410e3b`. Per-attempt installed identities match those built bytes. The default-theme hash remains `9ca00a7fe4f741c2ea48dfb543aae135c9ac8288619825a3ef754ca877dfb71a`.

The [paired fixture](examples/native-controlled-text/README.md) gives raw TextInput and Codon Input the same phrase, controlled ownership and input settings. Default props remain unset; correction-disabled scenarios are explicitly diagnostic. Mutable trace storage records native text/event counts, callback strings, selection/focus and `useLayoutEffect` observations of committed owner values. These are JavaScript observation times, not a trace of native commands or IME internals. Both immediate and settled native values are retained, with committed owner readouts and another comparison after finishing editing.

The installed activation preflight passes one case on Intel iOS 26.5 Release: parent/child/theme/controlled Select transitions, actual confirmation callback delivery and alert/parent closure. This does not retrospectively explain the earlier missed confirmation. Paired tests explicitly finish editing and verify keyboard disappearance before confirmation, separating activation/closure from text consistency. Trace export uses a bounded visible line and full accessible JSON, preventing a long trace from expanding the alert and moving its actions. The preflight uses the earlier, unexported-trace fixture; the paired matrix uses separately frozen final source/maps/binary and inspector inputs.

Focused checks pass: five consumer behavior cases, strict consumer types including ESNext without DOM libraries, shared lint with zero warnings and shared formatting. They verify controlled ownership and trace channels; they do not simulate native IME timing. The private packet retains successful and failed native attempts separately. Broader Android/rotation/large-text/physical matrices are outside this diagnostic run.

### Installed Paired Results

| Scenario            | Settings                         | First field | Result                                                                                                                                                                    |
| ------------------- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone          | Default                          | Codon       | Fails the focused owner-consistency gate; native text is complete while owner state remains `Na` until blur. Both fields and owners are complete after finishing editing. |
| Standalone          | Default                          | Raw         | Passes both fields, focused owner checks and final values.                                                                                                                |
| Standalone          | Corrections disabled, diagnostic | Codon       | Passes both fields, focused owner checks and final values.                                                                                                                |
| Standalone          | Corrections disabled, diagnostic | Raw         | Passes both fields, focused owner checks and final values.                                                                                                                |
| Nested choreography | Default                          | Codon       | Passes both fields, retained local draft, actual confirmation and closure.                                                                                                |
| Nested choreography | Default                          | Raw         | Passes both fields, retained local draft, actual confirmation and closure.                                                                                                |
| Nested choreography | Corrections disabled, diagnostic | Codon       | Passes both fields, retained local draft, actual confirmation and closure.                                                                                                |
| Nested choreography | Corrections disabled, diagnostic | Raw         | Passes both fields, retained local draft, actual confirmation and closure.                                                                                                |

The initial matrix passes seven of eight cases. The one authorized repeat of `standalone-default-codon-first` passes on the same verified binary, with full native/callback/committed owner values and event counts 1–17 for both fields. The original failed gate remains in the record; a passing repeat is not its repair.

The first failure shows delayed delivery, rather than the earlier wrong-native-text observation. Its native changes are `N`, `Na`, then the complete phrase, with contiguous event counts 1–3. The complete native change and callback are observed at blur; the next recorded owner commit contains that value. Before blur, both the explicit owner-commit trace and the inspector readout retain `Na`, although the native value is already complete. This is not just a stale owner label, and it supplies no evidence that the wrapper or owner setter transforms the callback string. It does not distinguish IME composition, native dispatch, JavaScript responsiveness or inspection-driver behavior.

Each case restarts the application; the simulator keyboard process and learned/predictive state are not reset between cases. XCTest executes the cases in its reported order. Consequently the correction-disabled successes do not causally establish a remedy for the earlier default failure. The new comparison uses a two-item numeric/string-zero Select and an empty field without surplus delete keystrokes; it is an independent isolation fixture rather than a byte-identical replay of the older trial. Default failures and final post-blur successes remain separate results.

## Existing Wrapper And Select Disposition

The requested [React Native Reusables comparison and Select triage](react-native-select-adoption-triage.md) pins upstream source, identifies the thin Input forwarding pattern and the named-host/iOS FullWindowOverlay techniques, and names an explicit decision before the next component family. Those techniques remain candidates rather than new Codon dependencies or evidence of complete parity. The existing controlled Codon Select remains in place.

## Evidence Location

The fresh consumer is `/private/tmp/codon-controlled-text-isolation-20261015`. The private evidence root is `/Users/gabrielbourget/.codex/visualizations/2026/10/11/01a12cc2-8c0c-71f1-b7aa-f055be011117/native-controlled-text-sequence-2026-10-15`. Accepted source/lock/archive/native project inputs, all three maps, actual binary/installed hashes, per-attempt inspector sources, results and captures stay in that packet. Earlier sealed packets remain read-only.
