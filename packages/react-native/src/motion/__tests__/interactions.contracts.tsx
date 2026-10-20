import type { GestureResponderEvent } from "react-native"

import type { TNativeKeyboardEvent } from "../../input/types"
import type { TNativeMotionInteractionProps, TNativeMotionTapEvent } from "../interactions/types"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

export const callbacks: TNativeMotionInteractionProps = {
  onPan: (event, info) => {
    const data = event.nativeEvent
    return [
      "pointerId" in data ? [data.pointerId, data.buttons, data.altKey] : data.identifier,
      info.delta.x,
      info.offset.y,
      info.velocity.x,
    ]
  },
  onTap: (event, info) => {
    const original: TNativeMotionTapEvent = event
    const horizontal: number = info.point.x
    return [original, horizontal]
  },
  onHoverStart: (event, info) => [event.nativeEvent.pointerType, info.point.y],
}
export const panEvent: TNativeMotionInteractionProps = {
  // @ts-expect-error Pan requires the original native pointer event, not a keyboard event.
  onPan: (event: TNativeKeyboardEvent) => event.nativeEvent.key,
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
