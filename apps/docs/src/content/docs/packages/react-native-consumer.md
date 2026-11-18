---
title: Native consumer bootstrap
description: App-owned entrypoint, providers, peers and native rebuild boundaries.
---

The native CLI target copies editable Codon implementations into the application, following the existing web CLI ownership model. It installs shared dependencies once and adds component-owned native source where selected. The native target is tested from source builds; no new CLI release is published. Install a locally verified CLI tarball as an application development dependency until publication is separately approved. The external Expo consumer has exercised the locally packed CLI, source installation and update, type checking, both-platform JS export and native autolinking. Installed consumer interaction and complete native lifecycle verification remain separate proof. Bare RN is unverified.

## Select the native CLI target

Use the bridge CLI build in an existing Expo SDK 57 development-client app:

```sh
cui init --target react-native
cui add button input click-popover --dependency-policy install --install-dependencies
```

The default target remains `react`. Native selection is recorded in `codon-ui.config.json`; subsequent add/status/diff/update/remove commands use that registry. Existing non-native config is never silently converted. Dependency installation retains the existing explicit policy and consent flags. Incompatible existing host pins are reported rather than upgraded.

With the default layout, import `Button` from `./src/components/Button`, `Input` from `./src/components/Input`, and provider exports from `./src/components/NativeRoot`. Their implementations and shared support are regular editable files under `src/components/_codon-ui-registry/utils/native`. The CLI owns provenance in `codon-ui.lock.json`; keep that file. Repeat adds reuse unchanged files. Changed files retain the existing protected update/remove behavior. Use `cui update --all --dry-run --json` to inspect updates before applying them. Native updates preserve the existing conservative file-set policy: a changed helper dependency set blocks before writes and requires a reviewed source migration or reinstallation. The CLI does not silently migrate native helper ownership. Updates within a stable dependency set remain supported, and local edits stay protected.

A root `react-native.config.js` points ordinary native autolinking at the copied local module. An existing conflicting root config is protected; merge the required entry deliberately instead of overwriting it. Rebuild after native source/spec/composition changes. Shared core support currently includes the date-segment backend because focus/form code references it. Table adds its own native sources and refreshes only clean registry-owned factory/build files. While a full Table factory remains required by other installed components, removal must retain the native files that factory references; source removal does not unload an installed binary.

Publication, upgrades, bare-RN installation, physical-device qualification and the final 52-component external-consumer proof are outside the results above.

## Host peers

The supported laboratory tuple is iOS/Android on Expo SDK 57. The exact current manifest versions are:

| Package                          | Version   | Owner                                           |
| -------------------------------- | --------- | ----------------------------------------------- |
| `react`                          | `19.2.3`  | Required host peer                              |
| `react-native`                   | `0.86.3`  | Required host peer, native runtime              |
| `react-native-safe-area-context` | `5.7.0`   | Required host peer, native insets               |
| `react-native-svg`               | `15.15.4` | Required host peer, native SVG                  |
| `react-native-teleport`          | `1.2.2`   | Required host peer, native portals              |
| `expo`                           | `57.0.26` | Showcase/app dependency, not a library peer     |
| `expo-dev-client`                | `57.0.19` | Showcase development binary, not a library peer |

Declare the native peers in the consuming application's manifest so its native tooling can discover them. Expo, navigation, app configuration, assets and routing remain app-owned. The selected registry graph declares `@internationalized/date`, `@internationalized/number` and `react-stately` in the application when needed, deduplicating the shared pins. Do not substitute web React, React Aria, CSS or RN Web setup. Other peer versions, operating systems and bare-RN builds have no support proof here.

The editable CLI path imports copied source directly. The private workspace package separately exposes `src/index.ts` to Metro and `dist` declarations to package consumers. For that in-repository package consumer, build declarations before checking types:

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/native-showcase typecheck
```

## Prepare Intl before importing the app

Intl initialization belongs in the application's first entry module, before `App`, the native barrel or modules that cache formatters. A component effect runs too late. The showcase's `apps/native-showcase/src/runtime/number-format.ts` is the maintained synchronous example. The native CLI copies it to the registry utilities runtime directory and declares its existing dependencies; import it explicitly before App. Keep its literal synchronous loads and capability checks. A separate consumer must not import the showcase at runtime.

```ts
// index.ts: use this file as the Expo application's package.json main.
import "./src/components/_codon-ui-registry/utils/runtime/number-format"

import { registerRootComponent } from "expo"

import App from "./App"

registerRootComponent(App)
```

For a bare-RN host, retain that first side-effect import, then use the host's existing `AppRegistry.registerComponent` and registered app name instead of Expo registration. This is entrypoint guidance, not verified bare-RN installation.

The current app-owned fallback pins are `@formatjs/intl-getcanonicallocales@3.2.12`, `@formatjs/intl-locale@5.3.12`, `@formatjs/intl-pluralrules@6.3.15` and `@formatjs/intl-numberformat@9.4.3`. The example preserves adequate existing NumberFormat/PluralRules independently, otherwise loads canonical-locale/Locale prerequisites, plural rules/data, then number formatting/data. Its number probes cover `formatToParts`, decimal precision, en-US/fr-CA/fr-FR/ar-EG and Arabic numbering; plural data covers the library's drag message locales. Adapt and validate data for the application's actual locales. The number fallback changes global Intl and Number/BigInt formatting methods; the library never installs it implicitly. This example does not prepare every Intl feature, including all date/time capabilities. Node/Jest results alone do not prove the installed Hermes runtime.

## Compose one application window

The following app-owned helper is checked against the public exports in `packages/react-native/type-tests/consumer-bootstrap.tsx`. Copy it into the consumer and use the CLI-installed NativeRoot exports below; it is not an exported Codon provider.

```tsx
import type { PropsWithChildren } from "react"
import { View } from "react-native"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import {
  DefaultNativeBackdropAdapter,
  NativeBackdropHost,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  type NativeThemeMode,
  type NativeThemeOverrides,
} from "./src/components/NativeRoot"

export const ConsumerRoot = ({
  children,
  mode = "light",
  overrides,
  enableBackdropBlur = true,
}: PropsWithChildren<{
  mode?: NativeThemeMode
  overrides?: NativeThemeOverrides
  enableBackdropBlur?: boolean
}>) => {
  const Window = enableBackdropBlur ? NativeBackdropHost : View
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <NativeThemeProvider mode={mode} overrides={overrides}>
        <NativeOverlayProvider backdropAdapter={enableBackdropBlur ? DefaultNativeBackdropAdapter : null}>
          <Window style={{ flex: 1 }}>
            <NativeFloatingLayerHost>
              <View style={{ flex: 1 }}>{children}</View>
            </NativeFloatingLayerHost>
          </Window>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
```

Use `<ConsumerRoot><AppContent /></ConsumerRoot>` in `App`. Keep it mounted while routes and controlled state change. Reuse an existing root SafeAreaProvider if the host already owns one; it supplies insets, while the app still owns safe-area padding, scrolling and keyboard avoidance. `initialWindowMetrics` is an initial root snapshot, not a value to reuse for a different native window.

NativeThemeProvider encloses the overlay tree so presentations retain caller theme/context. NativeOverlayProvider coordinates one root-to-leaf native window chain; nested providers are rejected. NativeFloatingLayerHost supplies a full-size native root for Tooltip, ClickPopover and other floating presentations in that same window, including its internal Teleport provider. Keep app padding/content layout on the child View. An overlay provider cannot replace a floating host. Modal/AlertDialog/Select create their own window-local hosts and safe-area handling; custom separate native windows need their own host.

Standalone showcase scenes that own their overlay provider run outside this helper.

`ConsumerRoot` supplies the backdrop adapter and host by default because `SortAndFilterPanel` requests blur by default. `Modal` and `AlertDialog` request blur through their `overlayBlur` prop. Apps that assemble providers directly must put `NativeBackdropHost` inside a `NativeOverlayProvider` with a backdrop adapter. The host must enclose the entire parent window, including the floating host.

Choose `enableBackdropBlur` before mounting. Changing it switches the window wrapper and remounts child content. For an app that deliberately uses the unblurred window, set `enableBackdropBlur={false}` on `ConsumerRoot` and pass `overlayBlur={false}` to `SortAndFilterPanel`. `DefaultNativeBackdropAdapter` supports cooperating native capture. Opaque video, GL, and custom renderers need the native capture cooperation described in the [package contracts](../react-native/).

## Theme and fonts

System fonts work without an asset loader. Map OS/account appearance to the explicit `light`/`dark` mode in the app; the provider defaults to light and does not read OS preferences. Optional overrides merge with the chosen mode's defaults.

For custom fonts, load/register the assets through the app's existing Expo or native asset workflow before rendering text that names them, then pass `overrides={{ typography: { fontFamilies: { body: "AppBody", heading: "AppHeading", display: "AppDisplay" } } }}` using the actual registered family names. These names are placeholders, not bundled fonts. Expo Font is not a library dependency or a requirement for system fonts. Keep a font-loading/error state in the app, and provide the actual faces/weights you use. Native weights are discrete supported RN values; custom raw RN Text needs explicit typography styles. CSS font imports and native-tree typography inheritance are not part of this bootstrap.

## Native linking and rebuilds

The package includes native code. Its `react-native.config.js`, `CodonNativeInput.podspec`, Android Gradle/CMake inputs and `package.json` Codegen configuration must travel with its JS/source. Normal consumer autolinking must discover one `CodonNativeInput` pod on iOS and `com.codonui.input.CodonInputPackage` plus its generated/native bindings on Android. Do not add duplicate manual registrations on top of autolinking. Copying only TS components, building `dist`, or running Metro does not install those native pieces.

Use an Expo development build containing the library and its native peers; Expo Go cannot acquire this package's custom native code. In a prepared showcase lab, `pnpm -F @codon-ui/native-showcase ios` or `android` builds/installs the development client. `start` only starts Metro for an already compatible binary. The app's `expo-dev-client` config plugin and native app configuration belong to that app. For CNG project generation, frozen Pod locks and prepared toolchains, follow the [native lab guide](../../foundation/native-lab/); prebuild can recreate ignored native directories. A bare-RN host owns its existing Pod/Gradle integration and platform commands and still needs independent build proof.

| Changed input                                                                   | Required development action                                                                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| JS/TS components, styles, theme values or JS Intl locale data                   | Metro/Fast Refresh; restart/reload from the entrypoint after Intl changes so cached formatters initialize again |
| Codon native sources, Codegen specs/config, native peers or native registration | Regenerate affected bindings/linkage and rebuild/install both affected platform binaries                        |
| Expo config plugins, scheme, native configuration or bundled font assets        | Apply the host's generation/asset workflow and rebuild/install when native resources/configuration change       |
| Stale JS cache only                                                             | Restart Metro with `--clear`; this cannot update native code                                                    |

Keep source/type checks, JS bundling, native compilation and installed interaction proof distinct. This reference adds no installer or native selection policy. After bridge integration, the separate consumer-fixtures work must prove actual CLI lifecycle, shared-native composition and iOS/Android builds against the delivered sources.
