# XCTest Lab Recovery And Frozen Query Comparison

Status: **XCTest lab recovered and reliability gate passed; frozen comparison next**. Gabriel requests fixing and validating the lab without an approval stop at each timeout, then resuming the frozen comparison. This supersedes the previous single-attempt diagnostic caps. Controlled values, production source, runtime pins, palette and raw/Input/ComboBox fixture remain frozen. Physical iPhone signing and ARM acceptance remain deferred.

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

After the reliability checkpoint is committed, execute raw → Input → ComboBox once each, with at most one conditional warm application repeat of the most reduced failing case. Preserve the focused-before-blur verdict, post-action trace export and conditional warm read-only native inspection. Keep default unpaced typing, keyboard/correction settings, controlled owner values and fixture source unchanged. The new guest/inspector/startup condition is explicit; a passing comparison does not erase RN-TEXT-01 or certify the original family acceptance matrix.

The web React verification surface remains the minimum native family baseline. The [coverage audit](react-native-searchable-selection-coverage.md) retains unsupported/deferred capabilities and missing supported customization assertions; native case counts and transport success do not establish parity. No maintained-scene, Android, physical/ARM or signing acceptance is propagated by lab recovery.

## Evidence And Verification

The working packet, to be sealed after comparison closeout, is `/Users/gabrielbourget/.codex/visualizations/2026/10/16/01a142c2-0db7-7d31-aa1f-53e3773a7870/native-xctest-lab-recovery-2026-10-16`. It preserves both failed native attempts, the prelaunch-only failure, service/process/readiness records, same-source inspector build and native preflight captures. All 67 installed app files match the frozen Release build before and after reliability validation. All 62 production source files match repo/archive/external package, the complete native package matches source producer `878a12d`, and the fixture matches `65817c3`. Archive, lock, pins, palette and controlled values remain unchanged.

Use focused private helper checks, native preflights/comparison, frozen input/build/installed identities, documentation formatting/build, normal commit hooks and git diff --check. Do not rebuild or broadly retest unchanged production source. At final closeout restore task settings, stop task guests, verify all eleven inherited manifests without executing/importing their sealed helpers and seal this packet after its final commit. Once sealed, never execute/import helpers inside it or write beneath it.
