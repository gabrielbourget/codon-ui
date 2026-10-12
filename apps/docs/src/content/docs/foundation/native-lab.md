---
title: Native Lab
description: SDK 57 lab requirements, generated project boundaries and reference capture.
---

The native laboratory uses Expo SDK 57, React Native 0.86.3, React 19.2.3 and the approved TypeScript/React-type pins. Its source/type/unit and two-platform JS proof are complete. The 2026-10-12 Android x86_64 lab produced development and local release binaries and inspected foundation states; iOS, physical-device accessibility and owner visual acceptance remain open. The canonical execution ledger is docs/roadmaps/react-native-library-first-pass.md and owns observed host availability and proof receipts.

## Select A Compatible Host

For the proposed Xcode 26.4.1 lane, use its supported macOS Tahoe 26.2–26.x range as documented in [Apple's Xcode requirements](https://developer.apple.com/xcode/system-requirements). SDK 57's [Expo matrix](https://docs.expo.dev/versions/latest/) is the framework-specific floor. Selecting Xcode 27 adds a scene-lifecycle configuration decision, so use the reviewed 26.x lane first.

The Android configuration extracted from the selected RN version catalog uses SDK compile/target 36, minimum 24, Build-Tools 36.0.0 and NDK 27.1.12297006. Generated Gradle is 9.3.1, Hermes and New Architecture are enabled. Use the JDK 17 lane described by [React Native's environment guide](https://reactnative.dev/docs/0.86/set-up-your-environment); exact installed tool versions and emulator profiles must be recorded before build acceptance.

[Android Studio's requirements](https://developer.android.com/studio/install) list 16 GB RAM and 16 GB free disk as the Studio/emulator minimum, recommending 32 GB RAM and 32 GB or more free disk. iOS tools, simulator runtimes and build caches need additional storage. Match downloaded tools/images to the host architecture. Hardware eligibility alone does not prove the selected native dependency build.

Choose host and storage before installing. OS upgrades, accepting SDK/tool licenses, account setup and new toolchain choices need their own explicit action/decision. Do not silently delete owner files, bypass the package release-age delay or activate paid build services.

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

The current viewport correction is a source/build checkpoint with partial Android portrait proof. Its complete large-text/action/rotation inspection remains blocked by recurring stock System UI ANRs during the 2026-10-12 lab run. Retain the open presentation finding and repeat that focused check on a stable Android lab before acceptance; a successful build or earlier pane-only smoke does not close it.

The current Android system-font setting change recreates the showcase and resets its in-memory scene state. Inspect each scale after that restart, then prove actions and fixture changes within the running scene. Rotation and app recreation are separate checks; do not infer persisted state across recreation from the fixture tests.

## Next Gate

Review the installed foundation and its reference captures, then approve the remaining Text/Button event/ref/style/color/hover decisions and the external-consumer slice. This lab preparation does not begin Wavemap product implementation or select the final headless foundation. See [Native Showcase](/component-library/native-showcase/) for fixtures and [React Native Package](/packages/react-native/) for source/runtime ownership.
