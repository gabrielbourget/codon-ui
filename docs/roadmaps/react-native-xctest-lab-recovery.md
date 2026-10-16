# XCTest Lab Recovery And Frozen Query Comparison

Status: **XCTest lab recovered; frozen comparison completed; RN-TEXT-01 remains open**. Gabriel requests fixing and validating the lab without an approval stop at each timeout, then resuming the frozen comparison. This supersedes the previous single-attempt diagnostic caps. Controlled values, production source, runtime pins, palette and raw/Input/ComboBox fixture remain frozen. Physical iPhone signing and ARM acceptance remain deferred.

## Recovered Setup

The [preceding startup receipt](react-native-runner-startup-receipt.md) establishes a native Accessibility-initialization failure before transport assertions. This run treats UI association, per-user services, guest initialization and private test products as one lab-health problem. It preserves failed attempts rather than repeatedly returning for approval at each timeout. No production Input/ComboBox repair, dependency/toolchain upgrade, global security/TCC reset or publication is included.

The original Simulator UI process still names an older Codon guest while commands target the retained searchable-selection guest. Replacing that verified task-owned UI process with an explicitly targeted process and passing the full Xcode developer directory/bin path does not restore XCTest: health-01 exits natively with code 65 after 272.39 seconds and reports the same Accessibility-loading failure. Developer mode is already enabled; targeted TCC logs establish no explicit Accessibility denial. No security preference is changed.

After all guests are stopped, restarting only the current user's task-bound Simulator UI, CoreSimulatorService and SimulatorTrampoline restores screenshot/settings access. The retained guest shows an unlocked normal home screen, but health-02 remains in runner installation and is interrupted after 337.42 seconds at its measured-work grace deadline. It has no completed native verdict. Service recovery alone therefore does not establish a healthy lab.

Create isolated iPhone 16e guest `C953A303-766A-4549-8B43-77C390079773` on the existing iOS 26.5 runtime `23F77`; preserve the retained and older guests without erasing them. Its first boot advances through BackBoard, migration and system-app initialization while live workers perform disk I/O. A 90-second silence cutoff interrupts the initial bootstatus waiter, not the guest; a separately bounded continuation completes. The first screenshot still has placeholder system icons. Host load is severe and later falls as assets appear; those observations establish startup pressure, not a unique causal attribution. A health-03 prelaunch installer lookup times out before creating an attempt marker or starting xcodebuild.

Rebuild only the unchanged private Swift inspector into fresh `ios-query-delivery-recovered-inspection-20261016` DerivedData, preserving the old cache and default LLDB scheme. Build-for-testing passes in 70.14 seconds; runner preinstallation completes in 4.02 seconds. The new inspector binary SHA-256 is `4a645f3d27c53213283a1faf2eeae71adfe8d53018333b93662242888bb9a2b0`; the frozen Swift source remains `c54db5ccccc2efcdb59efc682aad73c96aef775101292c1ee5f995783834b363`. This is a same-source recovery condition with a new inspector identity, not a byte-identical inspector replay. No React Native application rebuild occurs.

Private watchdogs now observe detailed `Session-*.log` changes as native progress as well as stdout. Four focused cases prove that nested native logs are observed, stable logs and unrelated attachments do not extend silence, and an absent bundle supplies no progress. Existing process-state/policy/counter helpers pass fifteen focused cases. Fixed total bounds remain; no input assertion is normalized into success.

## Reliability Gate

Three consecutive real native preflights pass with exit 0, exactly one passed test, zero failures, no installer grace and no controller termination. Each exported native capture contains the actual controlled-owner label `Transport 1`, with no editor opened. All 67 application files still match after validation.

| Condition                                | Attempt   | Native process seconds | Controlled owner |
| ---------------------------------------- | --------- | ---------------------: | ---------------- |
| First recovered-setup application launch | health-04 |                  36.51 | `Transport 1`    |
| Warm application restart                 | health-05 |                  18.25 | `Transport 1`    |
| Guest shutdown/reboot                    | health-06 |                  72.91 | `Transport 1`    |

The comparison gate is enabled only after these three successes. The recovered setup is operational; this sequence of interventions does not isolate a unique root cause or establish that the old guest/cache is repaired. Retain failed initialization and prelaunch records alongside the successful gate. The fresh guest's font category remains `large`; no keyboard, prediction or correction preference is changed.

## Frozen Comparison And Boundaries

Recovery checkpoint `bf6e202` commits the successful reliability gate. The frozen comparison then runs raw → Input → ComboBox → one warm raw repeat, with exactly four completed component verdicts. Values below come from the immutable focused-before-Close verdict; every case retains focus and an active keyboard.

| Case, in actual order       | Focused native/query/callback/owner/last-change text | Native changes / callbacks | Key observations                          | Maximum heartbeat gap |
| --------------------------- | ---------------------------------------------------- | -------------------------- | ----------------------------------------- | --------------------: |
| Raw TextInput               | `N` — failed intended phrase                         | 1 / 1                      | `Native query textNN` (19 events)         |                118 ms |
| Codon Input                 | `Native query text` — passed                         | 17 / 17                    | `Native query text` (17 events)           |                118 ms |
| ComboBox                    | `Native query text` — passed                         | 17 / 17                    | Unavailable through its frozen public API |                117 ms |
| Warm raw application repeat | `Native query text` — passed                         | 17 / 17                    | `Native query text` (17 events)           |                118 ms |

The first raw failure records native event count 1, query/callback/committed owner `N` and last selection `{start: 1, end: 1}`. It requests the phrase once with default unpaced typeText. JavaScript receives key observations for the full phrase plus two extra N events while its heartbeat continues; those observations do not prove UIKit applied each key. Ref detach/reattach callbacks retain the same recorded instance 1/tag 62 before the focused verdict. Post-Close observation remains `N`, with no compensating native change. Keep this failed native assertion as a failure; completing its diagnostic export does not convert it into a passing component test.

Input, ComboBox and the warm raw repeat reach all five full-text channels before Close, with native event count 17 and last selection at 17. The single warm raw repeat passes, so the failure-only 45-second inspection window is never entered and LLDB is never invoked. No marked-text/composition state is observed. The executed driver's legacy derived warm flag incorrectly denotes eligibility as a debugger pause; original records/source are preserved, corrected actual execution state is explicit in comparison-analysis.json, and the prepared helper now checks actual LLDB invocation. No native rerun follows that metadata correction.

This establishes N-only reproduction in the reduced raw case and continued JavaScript responsiveness during that observation window. Native main-thread/IME responsiveness, the extra N key observations and the missing native changes remain unattributed. A Codon-only production remedy is not supported; the passing warm repeat and the fixed case order do not isolate startup, runtime, IME or driver causality. The private packet includes a local runtime/driver report draft with exact pins, tested reduction and traces; it is not published. RN-TEXT-01 retains this signature and its distinct earlier full-native/Na-until-blur and raw-corruption evidence. No second controlled-value mirror, correction/pacing workaround or production repair is introduced.

A secondary automatic failed-case diagnostic collector still reports that its internal xcrun cannot find simctl. Explicit scoped summary/attachment exports succeed, including the completed raw assertion failure and focused trace; that collector notice does not replace the typing result. The warm test's longer bootstrap advances in native session logs and completes, without another guest cycle or component retry. The next attribution boundary is native/IME/driver text application and controlled native feedback in the reduced raw case; this bounded comparison is complete.

The web React verification surface remains the minimum native family baseline. The [coverage audit](react-native-searchable-selection-coverage.md) retains unsupported/deferred capabilities and missing supported customization assertions; native case counts and transport success do not establish parity. No maintained-scene, Android, physical/ARM or signing acceptance is propagated by lab recovery.

## Evidence And Verification

The evidence packet is `/Users/gabrielbourget/.codex/visualizations/2026/10/16/01a142c2-0db7-7d31-aa1f-53e3773a7870/native-xctest-lab-recovery-2026-10-16`. It preserves both failed native attempts, the prelaunch-only failure, service/process/readiness records, same-source inspector build, three successful preflights and all four comparison bundles/captures, including the failed first raw verdict. All 67 installed app files match the frozen Release build before and after reliability validation. All 62 production source files match repo/archive/external package, the complete native package matches source producer `878a12d`, and the fixture matches `65817c3`. Archive, lock, pins, palette and controlled values remain unchanged.

Use focused private helper checks, native preflights/comparison, frozen input/build/installed identities, documentation formatting/build, normal commit hooks and git diff --check. Do not rebuild or broadly retest unchanged production source. Final closeout confirms font category `large` unchanged, portrait teardown and all four known task guests stopped; the task-bound Simulator UI is stopped and prior guests are preserved without erase. All 67 app files still match after comparison; the new compiled inspector runner is preserved. Eleven inherited manifests verify unchanged across 6213 listed files, with the oldest packet's two pre-seal unlisted bytecode files retained as data. The new packet is sealed after the final commit. Once sealed, never execute/import helpers inside it or write beneath it.
