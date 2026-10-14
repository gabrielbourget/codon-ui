---
title: Native Lab
description: SDK 57 lab requirements, generated project boundaries and reference capture.
---

The native laboratory uses Expo SDK 57, React Native 0.86.3, React 19.2.3 and the approved TypeScript/React-type pins. Its source/type/unit and two-platform JS proof are complete. The 2026-10-12 Android and iOS x86_64 labs produced development and local release binaries and inspected foundation states, scrolling viewports, larger text and rotation. Physical-device accessibility and owner visual acceptance remain open. The canonical execution ledger is docs/roadmaps/react-native-library-first-pass.md and owns observed host availability and proof receipts.

## Select A Compatible Host

The installed and approved lane is Xcode 26.5 on macOS Tahoe 26.7.1. Use its supported Tahoe 26.2–26.x range as documented in [Apple's Xcode requirements](https://developer.apple.com/xcode/system-requirements). SDK 57's [Expo matrix](https://docs.expo.dev/versions/latest/) is the framework-specific floor. [Xcode 27 requires Apple silicon](https://developer.apple.com/documentation/xcode-release-notes/xcode-27-release-notes?changes=l_2_3&language=objc), so it cannot serve the selected Intel Mac. The earlier 26.4.1 proposal is retained as historical planning in the ledger.

The Android configuration extracted from the selected RN version catalog uses SDK compile/target 36, minimum 24, Build-Tools 36.0.0 and NDK 27.1.12297006. Generated Gradle is 9.3.1, Hermes and New Architecture are enabled. Use the JDK 17 lane described by [React Native's environment guide](https://reactnative.dev/docs/0.86/set-up-your-environment); exact installed tool versions and emulator profiles must be recorded before build acceptance.

[Android Studio's requirements](https://developer.android.com/studio/install) list 16 GB RAM and 16 GB free disk as the Studio/emulator minimum, recommending 32 GB RAM and 32 GB or more free disk. iOS tools, simulator runtimes and build caches need additional storage. Match downloaded tools/images to the host architecture. Hardware eligibility alone does not prove the selected native dependency build.

Choose host and storage before installing. OS upgrades, accepting SDK/tool licenses, account setup and new toolchain choices need their own explicit action/decision. Do not silently delete owner files, bypass the package release-age delay or activate paid build services.

## Selected Mac And iOS Preparation

On 2026-10-12 the owner selected this MacBookPro16,2 for Android and iOS, cleared storage, upgraded it from macOS 14.4.1 to 26.7.1 and installed Xcode 26.5 through the App Store's compatible-version offer. This is the 2020 13-inch four-port Intel model included in [Apple's Tahoe compatibility list](https://support.apple.com/en-us/122867). The owner completed Xcode's licence/welcome flow and installed the universal iOS 26.5 Simulator runtime, supporting x86_64 and arm64. [Apple documents component and architecture selection](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components).

The approved isolated lab uses Ruby 3.4.11 and CocoaPods 1.16.2 under `~/.local/share/codon-native-lab`, with separate gem and CocoaPods homes. Ruby was compiled from verified official source using existing host libraries; no Homebrew upgrade, system Ruby replacement or repository dependency change was required. [CocoaPods recommends a separate newer Ruby](https://guides.cocoapods.org/using/getting-started.html). Acquisition hashes and the resolved gem/Pod graphs belong to the private receipt.

The ignored iOS CNG project regenerated without React/RN pin updates. Pods installed successfully, followed by x86_64 development and local release Simulator builds using scoped `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`; the global developer-directory selection remains unchanged. The release embeds Hermes JS and runs with Metro stopped. Builds use `CODE_SIGNING_ALLOWED=NO` and establish Simulator evidence only. Physical devices, production signing and store distribution remain separate gates.

Use the isolated tools explicitly when resuming app-owned Expo commands:

```sh
CODON_NATIVE_LAB_ROOT="$HOME/.local/share/codon-native-lab"
env DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer GEM_HOME="$CODON_NATIVE_LAB_ROOT/ios-gems" GEM_PATH="$CODON_NATIVE_LAB_ROOT/ios-gems:$CODON_NATIVE_LAB_ROOT/ruby-3.4.11/lib/ruby/gems/3.4.0" PATH="$CODON_NATIVE_LAB_ROOT/ruby-3.4.11/bin:$CODON_NATIVE_LAB_ROOT/ios-gems/bin:$PATH" CP_HOME_DIR="$CODON_NATIVE_LAB_ROOT/cocoapods" COCOAPODS_DISABLE_STATS=true pnpm -F @codon-ui/native-showcase ios
```

The receipt's unsigned local-release check used Xcode's Release configuration for `CodonNativeShowcase` in the generated workspace, x86_64/active architecture, a selected task-owned Simulator destination and separate derived data. Reuse the recorded private reproduction helper for that exact lane; the normal Expo command above starts development use and does not reproduce the unsigned release receipt by itself.

Keep native compilation and Simulator inspection sequential on this host. Cold runtime migration and Apple's asset compiler stalled during initial attempts; sampled waits and interrupted logs are preserved. After task-device shutdown and a scoped CoreSimulator service restart with no other booted devices, both builds completed. The owner also explicitly approved `DevToolsSecurity -enable` for debugger/test diagnostics; this is a system authorization change recorded separately from isolated tools. Do not treat either recovery step as an established root cause or a routine setup requirement.

## Reproduce Source And Native Generation

Build declarations and prove the frozen graph first:

```sh
pnpm install --frozen-lockfile
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/react-native typecheck:contracts
pnpm -F @codon-ui/react-native test --runInBand
pnpm -F @codon-ui/native-showcase typecheck
pnpm -F @codon-ui/native-showcase test --runInBand
```

CNG owns the ignored platform projects. These commands generate them without native dependency installation or changing the approved React/RN versions:

```sh
pnpm -F @codon-ui/native-showcase exec expo prebuild --platform ios --no-install --skip-dependency-update react-native,react
pnpm -F @codon-ui/native-showcase exec expo prebuild --platform android --no-install --skip-dependency-update react-native,react
git diff -- apps/native-showcase/package.json pnpm-lock.yaml
```

Both skeletons were generated successfully during lab preparation; that is configuration evidence. Generation is [documented by Expo](https://docs.expo.dev/workflow/continuous-native-generation/) and may clear/recreate native directories. Keep native edits in app config/plugins, not hand-edited generated files. Check for unexpected package/config diffs before installation or build.

After the selected host has suitable Xcode/CocoaPods or Android SDK/JDK tooling:

```sh
pnpm -F @codon-ui/native-showcase ios
pnpm -F @codon-ui/native-showcase android
```

Record the clean generation, actual dependency installation, terminal build result and installed app identity. Add the relevant local release configuration before claiming release evidence. A JS export, Expo Go exploration or a dispatch message cannot close a native binary gate.

## Isolated Android Command-Line Lab

The 2026-10-12 lab setup uses Temurin 17.0.20.1+1, Android command-line tools 22.0, SDK 36 revision 2, Build-Tools 36.0.0, NDK 27.1.12297006, platform-tools 37.0.1 and stable emulator 37.2.12 with the Google APIs x86_64/API 36 image revision 7. CMake 3.30.5 was prepared from RN's source-build catalog; the generated app build actually selected and installed CMake 3.22.1, and its library builds also installed Build-Tools 35.0.0. These are host-owned tools under an isolated directory; shell profiles and repository dependency pins are unchanged. The owner approved the required SDK licence. Recheck publisher metadata/checksums and licence authority before recreating this lab elsewhere.

For a focused emulator-ABI build from the repository root:

```sh
CODON_NATIVE_LAB_ROOT="$HOME/.local/share/codon-native-lab"
env JAVA_HOME="$CODON_NATIVE_LAB_ROOT/jdk/Contents/Home" ANDROID_HOME="$CODON_NATIVE_LAB_ROOT/sdk" GRADLE_USER_HOME="$CODON_NATIVE_LAB_ROOT/gradle" pnpm -F @codon-ui/native-showcase exec sh -c 'cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon --max-workers=2 --console=plain'
env NODE_ENV=production JAVA_HOME="$CODON_NATIVE_LAB_ROOT/jdk/Contents/Home" ANDROID_HOME="$CODON_NATIVE_LAB_ROOT/sdk" GRADLE_USER_HOME="$CODON_NATIVE_LAB_ROOT/gradle" pnpm -F @codon-ui/native-showcase exec sh -c 'cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64 --no-daemon --max-workers=2 --console=plain'
```

Use this ABI selection only for the recorded x86_64 emulator lane; it does not verify ARM devices. Keep Gradle and emulator work sequential when the host is constrained. The task-owned Pixel 7 profile can use a lower framebuffer resolution with proportionally lower density (720×1600 at 280 dpi versus 1080×2400 at 420 dpi) to retain its logical window dimensions; record the actual app window, font scale and bounds after startup. This is a configured emulator, not physical Pixel hardware evidence. Keep emulator metrics collection disabled and private build/capture logs outside curated docs.

The generated local release variant uses the laboratory debug signing configuration. Its embedded-JS/offline smoke verifies that variant only; production signing, store distribution and ARM coverage need separate evidence. Initial cold builds took 25m5s for development and 16m7s for release on this Intel host, exceeding the preparation budget. Guest system-service ANR dialogs and one hierarchy-capture timeout were retained as resource limitations. Inspect active build children after a quiet interval and avoid running a cold build and emulator inspection together.

## Current Diagnostic Disposition

The online diagnostic recommends newer Expo/React-type patches and TypeScript 6. The lab keeps its previously approved frozen tuple; types and current native JS maps pass. At the 2026-10-11 exception receipt, Expo 57.0.27 was inside the seven-day buffer following its October 6 publication; recheck release age before a future upgrade. RN's installed React-types peer accepts the chosen version. Keep Doctor's recommendation failure visible; change pins through a reviewed toolchain pass rather than auto-fix or install exclusions.

pnpm also attaches an optional React DOM peer context under Expo. Actual iOS/Android Metro maps contain one native React package and one theme provider, with no React DOM, RN Web or web-library module paths. This is a disposition for the inspected native JS lane, not a web-support or future binary guarantee.

## Capture The Reference And Native States

Select the current owner-approved mobile-web environment first. Wavemap's component-showcase source is the initial Text/Button reference candidate, using its app-owned fonts/theme and ten-unit rem calibration. Source implementation, accepted presentation and unresolved UX are separate states; Add/Edit A4/B4 visual checkpoints remain open.

Each capture records source/build hash, SDK/dependencies, device/OS/window/fontScale, theme/locale, scene/state, capture owner, inspection result and private artifact location. Keep raw captures/logs out of curated docs by default.

Start with actual compact web viewports around 375×812 and 390×844 plus landscape/expanded inspection. On both native platforms inspect light/dark, customization, increment/reset, long copy, live resizing and vertical/horizontal synthetic gaps. Include normal and larger system text (1.5/2.0 where available), measured action regions, accessibility labels/selection/focus and VoiceOver/TalkBack. The ledger records exact target/profile choices when access exists.

State must survive fixture/window changes; reset is explicit. Simulated blocked regions do not prove a physical hinge, posture subscription, coordinate mapping or Activity recreation. Those remain an application adapter/probe gate.

Safe-area insets belong to the fixed showcase surface around the ScrollView; the scroll content owns its separate page padding. Content padding alone allowed large scrolled text to overlap Android's clock/status icons in the first lab inspection. Verify the bounded viewport against actual system bars in portrait, landscape and large-text captures; an unscrolled top screenshot cannot close this presentation check.

The current viewport correction passed its installed local-release inspection after a fresh task-owned Android guest recovered from stock system-service ANRs. At 1.5 and 2.0 text scale, actions and bottom copy remained reachable inside the portrait viewport; portrait → landscape → portrait retained scene state and equal panes, with scrolled content clear of the system bars. The iOS release subsequently passed the same foundation state/rotation inspection at normal text and scrolling reachability at observed scales 1.786 and 2.143. Its final end-of-scroll PNGs and exported bounds confirm the full action and bottom text inside the viewport. The ledger records exact artifacts, profiles, captures and test limits. The observed Android viewport finding is closed for its emulator artifact; physical accessibility and owner acceptance remain separate gates.

The current Android system-font setting change recreates the showcase and resets its in-memory scene state. Inspect each scale after that restart, then prove actions and fixture changes within the running scene. Rotation and app recreation are separate checks; do not infer persisted state across recreation from the fixture tests.

## Next Gate

Review the ledger's P2 fix and refreshed-capture receipt after the post-restart inspection and clipping/label follow-up. The three independent implementation findings are fixed in separate commits and follow-up source review passed; fresh Release maps and installed identities tie the new checks to that source. The maintained showcase exercises grouped/callback labels, custom-dimension callbacks and native shadow forms. Review refreshed states, larger text/footer, layouts and rotation with their recorded platform profiles; passing primary-state audits do not certify all color orders. The inherited palette remains unchanged and needs an owner/theme decision. Observed System UI recovery and private-inspector corrections do not establish a general host-failure cause. Complete owner visual and physical screen-reader/touch acceptance next. Apple account/signing preparation remains deferred until the owner is ready. This lab preparation does not begin Wavemap product implementation or select the final headless foundation. See [Native Showcase](/component-library/native-showcase/) for fixtures and [React Native Package](/packages/react-native/) for source/runtime ownership.
