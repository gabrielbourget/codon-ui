import type { RefObject } from "react"
import { findNodeHandle, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"

import type { TNativePopFrame, TNativePopRoot } from "./context"

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
const readFrame = (
  target: View,
  containingRoot?: View,
  query?: (encoded: string) => string,
): TNativeFabricPopFrame & { readonly lease?: string } => {
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
  if (!query && (!backend || typeof backend.getPopFrame !== "function"))
    throw failure("synchronous Fabric reader unavailable")
  const encoded = JSON.stringify({ target: targetTag, containingRoot: rootTag, requestId })
  const response: unknown = JSON.parse(query ? query(encoded) : backend!.getPopFrame(encoded))
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
    ...(typeof frame.lease === "string" ? { lease: frame.lease } : {}),
  })
}
export const readNativePopFrame = (target: View, containingRoot?: View): TNativeFabricPopFrame =>
  readFrame(target, containingRoot)

type TCapture = {
  lease: string
  target: View
  root?: View
  document: object | null | undefined
  targetTag: number
  rootTag: number
  scope: string
  released: boolean
  backend: Spec
}
export const createNativePopRoot = (
  target: () => View | null | undefined,
  options: { isCurrent?: () => boolean; scope?: () => string } = {},
): TNativePopRoot & {
  isCurrent: (frame: TNativePopFrame) => boolean
  dispose: () => void
  retireIfChanged: () => void
} => {
  const owner = `native-pop-owner:${++sequence}`,
    captures = new WeakMap<TNativePopFrame, TCapture>(),
    pending = new Set<TCapture>()
  const current = (capture: TCapture) => {
    try {
      return (
        target() === capture.target &&
        options.isCurrent?.() !== false &&
        (options.scope?.() ?? "") === capture.scope &&
        (capture.target as TConnectedNativeView).isConnected === true &&
        (capture.target as TConnectedNativeView).ownerDocument === capture.document &&
        tagOf(capture.target) === capture.targetTag &&
        (!capture.root ||
          ((capture.root as TConnectedNativeView).isConnected === true &&
            (capture.root as TConnectedNativeView).ownerDocument === capture.document &&
            tagOf(capture.root) === capture.rootTag))
      )
    } catch {
      return false
    }
  }
  const release = (capture: TCapture) => {
    if (capture.released) return
    const response = JSON.parse(
      capture.backend.popPresentation(JSON.stringify({ action: "release", owner, lease: capture.lease })),
    )
    if (response?.lease !== capture.lease || response.released !== true)
      throw failure("invalid release acknowledgement")
    capture.released = true
    pending.delete(capture)
  }
  const dispose = () => {
    for (const capture of [...pending]) release(capture)
  }
  return {
    read: (root?: RefObject<View | null>) => {
      dispose()
      const view = target(),
        parent = root?.current
      if (!view || (root && !parent) || options.isCurrent?.() === false)
        throw failure("actual current pop root required")
      const backend = TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
      if (!backend || typeof backend.popPresentation !== "function")
        throw failure("native presentation layer unavailable")
      const scope = options.scope?.() ?? "",
        document = (view as TConnectedNativeView).ownerDocument
      let capture: TCapture | undefined
      try {
        const frame = readFrame(view, parent ?? undefined, (encoded) => {
          const input = JSON.parse(encoded)
          const response = backend.popPresentation(JSON.stringify({ ...input, action: "capture", owner }))
          const lease: unknown = JSON.parse(response)?.lease
          if (typeof lease !== "string" || !lease) throw failure("native presentation lease unavailable")
          capture = {
            lease,
            target: view,
            root: parent ?? undefined,
            document,
            scope,
            targetTag: input.target,
            rootTag: input.containingRoot,
            released: false,
            backend,
          }
          pending.add(capture)
          return response
        })
        if (!capture || !current(capture)) throw failure("pop root retired during capture")
        captures.set(frame, capture)
        return frame
      } catch (error) {
        if (capture) release(capture)
        throw error
      }
    },
    freeze: (frame, anchorX, anchorY) => {
      const capture = captures.get(frame)
      if (!capture || capture.released || !current(capture)) {
        if (capture) release(capture)
        throw failure("foreign or retired frame cannot activate a presentation")
      }
      try {
        const response = JSON.parse(
          capture.backend.popPresentation(
            JSON.stringify({ action: "activate", owner, lease: capture.lease, anchorX, anchorY }),
          ),
        )
        if (response?.lease !== capture.lease || response.released !== false)
          throw failure("invalid activation acknowledgement")
        if (!current(capture)) throw failure("pop root retired during activation")
      } catch (error) {
        release(capture)
        throw error
      }
      return () => release(capture)
    },
    dispose,
    isCurrent: (frame) => {
      const capture = captures.get(frame)
      return Boolean(capture && !capture.released && current(capture))
    },
    retireIfChanged: () => {
      for (const capture of [...pending]) if (!current(capture)) release(capture)
    },
  }
}
