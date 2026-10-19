import type { View } from "react-native"

import { readNativePopFrame } from "../presence/nativePopFrame"

export const popFrameContracts = (target: View, root: View) => {
  const frame = readNativePopFrame(target, root)
  const revision: string = frame.fabricRevision
  // @ts-expect-error Captured metrics are immutable.
  frame.width = 100
  // @ts-expect-error Caller rectangles cannot substitute for an actual ref.
  readNativePopFrame({ x: 0, y: 0, width: 10, height: 10 })
  // @ts-expect-error Frame revisions preserve their native string identity.
  const numericRevision: number = frame.fabricRevision
  return { revision, numericRevision }
}
