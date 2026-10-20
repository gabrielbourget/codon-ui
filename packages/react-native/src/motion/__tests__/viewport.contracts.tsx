import { createRef } from "react"
import type { ScrollView, View } from "react-native"

import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"
import type { TNativeViewportEntry } from "../viewport/types"

export const viewportContracts = () => {
  const root = createRef<View>(),
    scrollRoot = createRef<ScrollView>(),
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
  const scroll = <NativeMotionOwnerHost motion={{ viewport: { root: scrollRoot }, whileInView: { opacity: 1 } }} />
  // @ts-expect-error Native root refs require actual native views.
  const wrongRoot = <NativeMotionOwnerHost motion={{ viewport: { root: { current: {} } } }} />
  // @ts-expect-error Native viewport amount retains the source option names.
  const wrongAmount = <NativeMotionOwnerHost motion={{ viewport: { amount: "visible" } }} />
  return { valid, scroll, wrongRoot, wrongAmount }
}
