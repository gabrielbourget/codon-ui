import type { View } from "react-native"

import { createNativePopRoot, readNativePopFrame } from "../presence/nativePopFrame"

export const popFrameContracts = (target: View, root: View) => {
  const frame = readNativePopFrame(target, root)
  const revision: string = frame.fabricRevision
  const owner = createNativePopRoot(() => target)
  const captured = owner.read({ current: root })
  owner.freeze(captured, "right", "bottom")
  // @ts-expect-error Native pop anchors retain the source physical names.
  owner.freeze(captured, "inline-start", "top")
  // @ts-expect-error Captured metrics are immutable.
  frame.width = 100
  // @ts-expect-error Caller rectangles cannot substitute for an actual ref.
  readNativePopFrame({ x: 0, y: 0, width: 10, height: 10 })
  // @ts-expect-error Frame revisions preserve their native string identity.
  const numericRevision: number = frame.fabricRevision
  return { revision, numericRevision }
}
