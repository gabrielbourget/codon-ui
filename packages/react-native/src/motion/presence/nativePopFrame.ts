import { findNodeHandle, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"

import type { TNativePopFrame } from "./context"

export type TNativeFabricPopFrame = Readonly<
  TNativePopFrame & {
    kind: "native-pop-frame"
    requestId: string
    target: number
    surfaceId: number
    fabricRevision: string
    positionedParent: number
  }
>
type TConnectedNativeView = View & { readonly isConnected?: boolean; readonly ownerDocument?: object | null }
const failure = (message: string) => new Error(`Native popLayout: ${message}`)
const tagOf = (view: View) => {
  const tag = findNodeHandle(view)
  if (tag === null || !Number.isInteger(tag) || tag <= 0 || tag > 2147483647)
    throw failure("actual native tag required")
  return tag
}
let sequence = 0

// This is an immutable input read, not a mounted-frame acknowledgement or an
// activation of the presentation layer. A caller cannot supply its own box.
export const readNativePopFrame = (target: View, containingRoot?: View): TNativeFabricPopFrame => {
  const view = target as TConnectedNativeView,
    root = containingRoot as TConnectedNativeView | undefined,
    document = view.ownerDocument
  const connected = () =>
    view.isConnected === true &&
    document !== null &&
    document !== undefined &&
    view.ownerDocument === document &&
    (!root || (root.isConnected === true && root.ownerDocument === document))
  if (!connected()) throw failure("connected refs in one native document required")
  const targetTag = tagOf(target),
    rootTag = containingRoot ? tagOf(containingRoot) : 0,
    requestId = `native-pop-frame:${++sequence}`
  const backend = TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
  if (!backend || typeof backend.getPopFrame !== "function") throw failure("synchronous Fabric reader unavailable")
  const response: unknown = JSON.parse(
    backend.getPopFrame(JSON.stringify({ target: targetTag, containingRoot: rootTag, requestId })),
  )
  if (!response || typeof response !== "object") throw failure("invalid Fabric frame response")
  const frame = response as Record<string, unknown>
  if (
    frame.kind !== "native-pop-frame" ||
    frame.requestId !== requestId ||
    frame.target !== targetTag ||
    !Number.isInteger(frame.surfaceId) ||
    (frame.surfaceId as number) <= 0 ||
    !Number.isInteger(frame.positionedParent) ||
    (frame.positionedParent as number) <= 0 ||
    typeof frame.fabricRevision !== "string" ||
    !/^\d+$/.test(frame.fabricRevision) ||
    ![frame.width, frame.height, frame.left, frame.top, frame.right, frame.bottom].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    ) ||
    (frame.width as number) < 0 ||
    (frame.height as number) < 0 ||
    (frame.direction !== "ltr" && frame.direction !== "rtl")
  )
    throw failure("invalid Fabric frame identity or metrics")
  if (!connected() || tagOf(target) !== targetTag || (containingRoot && tagOf(containingRoot) !== rootTag))
    throw failure("native ref/document retired during frame capture")
  return Object.freeze({
    kind: "native-pop-frame",
    requestId,
    target: targetTag,
    surfaceId: frame.surfaceId as number,
    fabricRevision: frame.fabricRevision,
    positionedParent: frame.positionedParent as number,
    width: frame.width as number,
    height: frame.height as number,
    left: frame.left as number,
    top: frame.top as number,
    right: frame.right as number,
    bottom: frame.bottom as number,
    direction: frame.direction,
  })
}
