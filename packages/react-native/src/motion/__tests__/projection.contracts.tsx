import { createRef } from "react"
import type { View } from "react-native"

import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"
import { NativeAnimatePresence } from "../presence/NativeAnimatePresence"
import { NativeLayoutGroup } from "../projection/NativeLayoutGroup"

export const layout = (
  <NativeLayoutGroup id="group" inherit="id">
    <NativeAnimatePresence mode="popLayout" anchorX="right" anchorY="bottom" root={createRef<View>()}>
      <NativeMotionOwnerHost
        key="owner"
        motion={{
          layout: "position",
          layoutId: "item",
          layoutAnchor: { x: 0.5, y: 0.5 },
          layoutCrossfade: false,
          initial: { opacity: 1 },
          exit: { opacity: 0 },
          onLayoutMeasure: (box, previous) => {
            void box.x.min
            void previous?.y.max
          },
        }}
      />
    </NativeAnimatePresence>
  </NativeLayoutGroup>
)
// @ts-expect-error Layout roots are actual native refs, not DOM/CSS selectors.
export const invalidRoot = <NativeAnimatePresence root="#root" />
// @ts-expect-error Layout modes retain the pinned named choices.
export const invalidMode = <NativeMotionOwnerHost motion={{ layout: "slide" }} />
export const invalidTransform = (
  <NativeMotionOwnerHost
    motion={{ layout: true }}
    // @ts-expect-error A generated native matrix/transform array is required.
    transformTemplate={() => "translateX(10px)"}
  />
)
