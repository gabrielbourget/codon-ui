import { createRef } from "react"
import { Animated, PlatformColor, type View } from "react-native"

import { Text, ToggleButton, type ToggleButtonProps } from "../src"

export const props: ToggleButtonProps = {
  isSelected: false,
  defaultSelected: false,
  onChange: (selected: boolean) => selected,
  autoFocus: true,
  width: "100%",
  height: 0,
  color: PlatformColor("systemBlueColor"),
  raised: false,
  customStyles: { color: "orange" },
  style: (state) => [state.defaultStyle, { opacity: state.isSelected ? 1 : 0.5 }],
  onPress: (event) => event.nativeEvent.timestamp,
  children: ({ state, foregroundColor }) => <Text color={foregroundColor}>{String(state.isSelected)}</Text>,
}
export const Valid = <ToggleButton {...props} ref={createRef<View>()} />
export const AnimatedRootStyle = <ToggleButton style={{ width: new Animated.Value(100) }} />
// @ts-expect-error Selection is boolean, not a string-key axis.
export const InvalidSelection = <ToggleButton isSelected="yes" />
// @ts-expect-error Selection semantics are owned.
export const InvalidChecked = <ToggleButton aria-checked={false} />
// @ts-expect-error Selection semantics are owned.
export const InvalidState = <ToggleButton accessibilityState={{ checked: false }} />
// @ts-expect-error Busy/pending is not part of the canonical toggle contract.
export const InvalidPending = <ToggleButton isPending />
// @ts-expect-error Button-only transparent mode is not a toggle customization prop.
export const InvalidTransparent = <ToggleButton transparent />
// @ts-expect-error Native dimensions do not accept CSS rem units.
export const InvalidWidth = <ToggleButton width="12rem" />
// @ts-expect-error The named dimension shorthand is static, not an animated style slot.
export const InvalidAnimatedWidth = <ToggleButton width={new Animated.Value(10)} />
// @ts-expect-error Explicit null is not a configured static dimension.
export const InvalidNullHeight = <ToggleButton height={null} />
// @ts-expect-error Native refs expose View methods, not DOM buttons.
export const InvalidRef = <ToggleButton ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Browser classes are replaced by native styles.
export const InvalidClass = <ToggleButton className="web" />
// @ts-expect-error Upstream React Aria slot context is not a native host API.
export const InvalidSlot = <ToggleButton slot="item" />
// @ts-expect-error Native press payloads are not web PressEvents.
export const InvalidPress = <ToggleButton onPress={(event: { pointerType: string }) => event.pointerType} />
// @ts-expect-error Native render state makes no focus-visible modality claim.
export const InvalidModality = <ToggleButton>{(state) => String(state.isFocusVisible)}</ToggleButton>
