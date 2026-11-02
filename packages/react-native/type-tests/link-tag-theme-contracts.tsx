import { PlatformColor } from "react-native"

import {
  Link,
  NativeThemeProvider,
  Tag,
  type NativeTheme,
  type NativeThemeTransition,
  type NativeThemeOverrides,
  type TNativeTagTransition,
} from "../src"

export const legacyThemeRemainsValid = (theme: Omit<NativeTheme, "transitions">): NativeTheme => theme
export const legacyActionRemainsValid = (
  action: Omit<NativeTheme["actions"]["primary"], "visitedForeground">,
): NativeTheme["actions"]["primary"] => action
export const sharedTiming: NativeThemeTransition = { duration: "0.3s", delay: 0, easing: "linear" }
export const existingTagTiming: TNativeTagTransition = sharedTiming
export const OptionalNativeRoles = (
  <NativeThemeProvider
    overrides={{
      actions: { primary: { visitedForeground: PlatformColor("systemBlueColor") } },
      transitions: { backgroundColor: 0, color: sharedTiming, borderColor: "20ms", boxShadow: { delay: "0.1s" } },
    }}
  >
    <Link href="original" order="primary" isVisited visitedColor="purple">
      Visited
    </Link>
    <Tag pressable isPressed={false} onPress={() => undefined} width={140} backgroundColorTransition={0}>
      Long native labels remain complete
    </Tag>
  </NativeThemeProvider>
)
type TVisitedOverride = NonNullable<NonNullable<NativeThemeOverrides["actions"]>["primary"]>
// @ts-expect-error Visited foreground uses the native ColorValue contract.
export const InvalidVisitedRole: TVisitedOverride = { visitedForeground: true }
// @ts-expect-error Native transitions exclude CSS property shorthands.
export const InvalidCSSTiming = <NativeThemeProvider overrides={{ transitions: { color: "color 1s linear" } }} />
// @ts-expect-error Each channel uses a supported native easing.
export const InvalidTimingEasing = <NativeThemeProvider overrides={{ transitions: { color: { easing: "spring" } } }} />
// @ts-expect-error Delay is a numeric or native unit duration.
export const InvalidTimingDelay = <NativeThemeProvider overrides={{ transitions: { boxShadow: { delay: false } } }} />
// @ts-expect-error Only approved channels are exposed.
export const InvalidTransitionChannel = <NativeThemeProvider overrides={{ transitions: { foreground: 10 } }} />
