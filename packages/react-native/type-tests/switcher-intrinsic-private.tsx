import { NativeFocusView, ToggleSwitcher, type ToggleSwitcherProps } from "../src"

const choices = { items: [{ id: "and", label: "Match all" }] } satisfies ToggleSwitcherProps

export const PublicSwitcher = <ToggleSwitcher {...choices} />
export const PublicFocus = <NativeFocusView accessibilityLabel="Focusable content" />

// @ts-expect-error Frame observation belongs to the private original-view adapter.
export const PrivateSwitcherFrames = <ToggleSwitcher {...choices} nativeMotionGeometryObserveFrames={false} />
export const BarePublicFocus = <NativeFocusView />

// @ts-expect-error The public focus receiver does not expose private geometry policy.
export const PrivateFocusFrames = <NativeFocusView nativeMotionGeometryObserveFrames={false} />
