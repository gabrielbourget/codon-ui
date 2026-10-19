import type { GestureResponderEvent } from "react-native"

import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"
import type { TNativeMotionInteractionProps } from "../interactions/types"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

export const callbacks: TNativeMotionInteractionProps = {
  onTap: (event, info) => {
    const original: TNativePressEvent = event
    const horizontal: number = info.point.x
    return [original, horizontal]
  },
  onHoverStart: (event, info) => [event.nativeEvent.pointerType, info.point.y],
}
export const host = <NativeMotionOwnerHost motion={{ whileTap: { opacity: 0.5 }, ...callbacks }} />
export const browserCallback: TNativeMotionInteractionProps = {
  // @ts-expect-error The original native event union is not a browser PointerEvent.
  onTap: (event: PointerEvent) => event.pageX,
}
export const narrowedCallback: TNativeMotionInteractionProps = {
  // @ts-expect-error Keyboard/accessibility activation cannot be narrowed to responder-only events.
  onTap: (event: GestureResponderEvent) => event.nativeEvent.pageX,
}
export const keyboardCallback: TNativeMotionInteractionProps = {
  // @ts-expect-error Pointer and accessibility activation cannot be narrowed to keyboard-only events.
  onTap: (event: TNativeKeyboardEvent) => event.nativeEvent.key,
}
