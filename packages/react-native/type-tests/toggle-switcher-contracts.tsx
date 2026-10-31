import { createRef } from "react"
import { Animated, PlatformColor, type View } from "react-native"

import { ToggleSwitcher, type ToggleSwitcherItem, type ToggleSwitcherProps } from "../src"

const items: readonly ToggleSwitcherItem[] = [
  { id: "", label: "Empty key" },
  { id: "next", label: "Next", disabled: false, accessibilityLabel: "Next option" },
]
export const props: ToggleSwitcherProps = {
  items,
  selectedKey: "",
  defaultSelectedKey: "next",
  onSelectionChange: (key: string) => key,
  isDisabled: false,
  isReadOnly: false,
  width: "100%",
  height: 0,
  fontSize: 0,
  color: PlatformColor("systemBlueColor"),
  optionFontWeight: "lighter",
  selectedOptionFontWeight: "bolder",
  customOptionStyles: [{ minHeight: 32, color: "teal", fontSize: 14, textTransform: "uppercase" }],
  customSelectedOptionStyles: { fontWeight: "800", borderRadius: 5, width: new Animated.Value(80) },
  style: ({ defaultStyle, selectedKey }) => [defaultStyle, { opacity: selectedKey === "" ? 1 : 0.5 }],
}
export const Valid = <ToggleSwitcher {...props} ref={createRef<View>()} />
// @ts-expect-error The selection key retains its string identity.
export const InvalidKey = <ToggleSwitcher items={items} selectedKey={0} />
// @ts-expect-error null is not a string-key selection state.
export const InvalidNull = <ToggleSwitcher items={items} selectedKey={null} />
// @ts-expect-error Items have string IDs, not numeric keys.
export const InvalidItem = <ToggleSwitcher items={[{ id: 0, label: "Zero" }]} />
// @ts-expect-error Static shorthand dimensions exclude animated nodes.
export const InvalidAnimatedWidth = <ToggleSwitcher items={items} width={new Animated.Value(80)} />
// @ts-expect-error Static shorthand dimensions exclude null.
export const InvalidNullHeight = <ToggleSwitcher items={items} height={null} />
// @ts-expect-error CSS dimensions use native logical units or percentages.
export const InvalidWidth = <ToggleSwitcher items={items} width="12rem" />
// @ts-expect-error Font size is a native number.
export const InvalidFontSize = <ToggleSwitcher items={items} fontSize="14px" />
// @ts-expect-error Arbitrary weight aliases are unsupported.
export const InvalidWeight = <ToggleSwitcher items={items} optionFontWeight="heavy" />
// @ts-expect-error Native root semantics are owned.
export const InvalidRole = <ToggleSwitcher items={items} role="radio" />
// @ts-expect-error DOM classes are represented by native style slots.
export const InvalidClass = <ToggleSwitcher items={items} customOptionClassName="web" />
// @ts-expect-error The collection owns its visual children.
export const InvalidChildren = <ToggleSwitcher items={items}>Child</ToggleSwitcher>
// @ts-expect-error The root ref is a native View.
export const InvalidRef = <ToggleSwitcher items={items} ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Selection callbacks publish the exact string key.
export const InvalidCallback = <ToggleSwitcher items={items} onSelectionChange={(key: number) => key} />
