import { createRef } from "react"
import { Animated, PlatformColor, type View } from "react-native"

import { Avatar, type AvatarProps } from "../src"

export const avatarProps: AvatarProps = {
  size: "40",
  foreground: PlatformColor("systemBlueColor"),
  imageURL: "data:image/png;base64,...",
  name1: "Alice",
  clickable: true,
  onPress: (event) => event.nativeEvent.pageX,
  customTextProps: { allowFontScaling: true, variant: "b9", style: { fontSize: 20 } },
  customImageStyles: { resizeMode: "cover" },
  customFallbackStyles: { color: "green" },
  style: (state) => [state.defaultStyle, { opacity: state.isPressed ? 0.8 : 1 }],
}
export const ValidAvatar = <Avatar {...avatarProps} ref={createRef<View>()} />
export const ZeroAvatar = <Avatar size={0} labels={{ placeholderFirstName: "", placeholderLastName: "" }} />
export const AnimatedAvatar = <Avatar style={{ width: new Animated.Value(40) }} />
// @ts-expect-error CSS lengths use native dimensions/styles.
export const InvalidAvatarSize = <Avatar size="2rem" />
// @ts-expect-error Named static dimensions reject animated nodes.
export const InvalidAvatarAnimatedSize = <Avatar size={new Animated.Value(40)} />
// @ts-expect-error Null is not an Avatar size.
export const InvalidAvatarNullSize = <Avatar size={null} />
// @ts-expect-error Avatar owns graphic children.
export const InvalidAvatarChildren = <Avatar>Other content</Avatar>
// @ts-expect-error DOM root classes have native style owners.
export const InvalidAvatarClass = <Avatar className="web" />
// @ts-expect-error Native onPress replaces browser click events.
export const InvalidAvatarClick = <Avatar onClick={() => undefined} />
// @ts-expect-error Arbitrary DOM host replacement is not a native host API.
export const InvalidAvatarAsChild = <Avatar asChild />
// @ts-expect-error The root owns image/button semantics.
export const InvalidAvatarRole = <Avatar role="checkbox" />
// @ts-expect-error Fallback typography cannot replace its initials.
export const InvalidAvatarTextChildren = <Avatar customTextProps={{ children: "Other" }} />
// @ts-expect-error Fallback text is decorative within the root action.
export const InvalidAvatarTextAction = <Avatar customTextProps={{ onPress: () => undefined }} />
// @ts-expect-error Actual native View refs are retained.
export const InvalidAvatarRef = <Avatar ref={createRef<{ tagName: string }>()} />
