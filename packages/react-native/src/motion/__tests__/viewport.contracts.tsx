import { createRef } from "react"
import type { View } from "react-native"

import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"
import type { TNativeViewportEntry } from "../viewport/types"

export const viewportContracts = () => {
  const root = createRef<View>(),
    enter = (entry: TNativeViewportEntry) => entry.target.measure(() => {})
  const valid = (
    <NativeMotionOwnerHost
      motion={{
        whileInView: { opacity: 1 },
        viewport: { root, amount: "all", margin: "2px 10%", once: true },
        onViewportEnter: enter,
      }}
    />
  )
  // @ts-expect-error Native root refs require actual native views.
  const wrongRoot = <NativeMotionOwnerHost motion={{ viewport: { root: { current: {} } } }} />
  // @ts-expect-error Native viewport amount retains the source option names.
  const wrongAmount = <NativeMotionOwnerHost motion={{ viewport: { amount: "visible" } }} />
  return { valid, wrongRoot, wrongAmount }
}
