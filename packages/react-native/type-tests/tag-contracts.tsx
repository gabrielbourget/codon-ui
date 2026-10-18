import { createRef } from "react"
import { Animated, PlatformColor, type View } from "react-native"

import { Tag, type TagProps } from "../src"

export const StaticTag = (
  <Tag
    color={PlatformColor("systemBlueColor")}
    border={{ borderWidth: 2, borderColor: "green", borderStyle: "dashed" }}
    role="group"
    aria-live="polite"
    aria-disabled={false}
    ref={createRef<View>()}
  >
    Status
  </Tag>
)
export const pressedProps: TagProps = {
  pressable: true,
  isPressed: false,
  onPress: (id) => String(id),
  id: 0,
  width: "50%",
  height: 0,
  inactiveBorder: "none",
  activeBorder: { borderWidth: 1 },
  "aria-pressed": "mixed",
  backgroundColorTransition: { duration: "1s", delay: 20, easing: "linear" },
  hoverCursor: "pointer",
  focusOutline: { outlineWidth: 2, outlineColor: "purple" },
  outlineOffset: 0,
  customStyles: { fontSize: 20 },
  style: (state) => [state.defaultStyle, { opacity: state.isPressing ? 0.8 : 1 }],
}
export const PressedTag = <Tag {...pressedProps} />
export const AnimatedTag = <Tag style={{ width: new Animated.Value(40), shadowOpacity: new Animated.Value(0.2) }} />
// @ts-expect-error Pressable state is controlled and required.
export const InvalidMissingTagState = <Tag pressable onPress={() => undefined} />
// @ts-expect-error Pressable callback is required.
export const InvalidMissingTagCallback = <Tag pressable isPressed={false} />
// @ts-expect-error Static tags do not receive selection state.
export const InvalidStaticTagState = <Tag isPressed />
// @ts-expect-error Static tags do not receive press callbacks.
export const InvalidStaticTagCallback = <Tag onPress={() => undefined} />
// @ts-expect-error Static tags expose native View events rather than press-responder controls.
export const InvalidStaticTagNativePress = <Tag onPressIn={() => undefined} />
// @ts-expect-error Android press feedback belongs to the interactive branch.
export const InvalidStaticTagRipple = <Tag android_ripple={{ color: "red" }} />
// @ts-expect-error Tag callbacks receive the exact typed id, not an invented selected value.
export const InvalidTagCallbackPayload = <Tag pressable isPressed={false} onPress={(selected: boolean) => selected} />
// @ts-expect-error No uncontrolled selection mirror exists.
export const InvalidTagDefault = <Tag pressable isPressed={false} onPress={() => undefined} defaultPressed />
// @ts-expect-error Native borders replace CSS shorthand.
export const InvalidTagBorder = <Tag border="2px solid red" />
// @ts-expect-error Native timing replaces CSS transition syntax.
export const InvalidTagTransition = <Tag backgroundColorTransition="background-color 1s linear" />
// @ts-expect-error Native cursors support the host's auto/pointer values.
export const InvalidTagCursor = <Tag hoverCursor="grab" />
// @ts-expect-error Numeric native outline offsets replace CSS units.
export const InvalidTagOffset = <Tag outlineOffset="2px" />
// @ts-expect-error Native dimensions replace CSS units.
export const InvalidTagWidth = <Tag width="4rem" />
// @ts-expect-error Static named dimensions reject animated nodes.
export const InvalidTagAnimatedWidth = <Tag width={new Animated.Value(40)} />
// @ts-expect-error Browser class aliases use native styles.
export const InvalidTagClass = <Tag customClassName="web" />
// @ts-expect-error Interactive semantics are owned.
export const InvalidTagRole = <Tag pressable isPressed={false} onPress={() => undefined} role="checkbox" />
// @ts-expect-error Native checked aliases cannot replace aria-pressed ownership.
export const InvalidTagChecked = <Tag pressable isPressed={false} onPress={() => undefined} aria-checked />
// @ts-expect-error Root refs are actual native Views.
export const InvalidTagRef = <Tag ref={createRef<{ tagName: string }>()} />
