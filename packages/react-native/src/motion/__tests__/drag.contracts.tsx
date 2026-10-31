import { createRef } from "react"
import type { View } from "react-native"

import { NativeDragControls } from "../interactions/NativeDragControls"
import { motionValue } from "../kernel"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

export const controls = new NativeDragControls()
export const drag = (
  <NativeMotionOwnerHost
    motion={{
      drag: "x",
      dragControls: controls,
      dragConstraints: createRef<View>(),
      _dragX: motionValue(0),
      dragSnapToOrigin: "x",
      onDrag: (event, info) => {
        void event.nativeEvent
        void info.velocity.x
      },
    }}
  />
)
// @ts-expect-error DOM/CSS constraint selectors are not native refs.
export const selector = <NativeMotionOwnerHost motion={{ drag: true, dragConstraints: "#bounds" }} />
// @ts-expect-error Drag constraints retain numeric geometry.
export const textBounds = <NativeMotionOwnerHost motion={{ drag: true, dragConstraints: { right: "10px" } }} />
// @ts-expect-error Original native gesture events are required by manual controls.
controls.start({ pageX: 0, pageY: 0 })
