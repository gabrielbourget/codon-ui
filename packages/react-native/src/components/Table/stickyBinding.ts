import { findNodeHandle, processColor, TurboModuleRegistry, type ColorValue, type View } from "react-native"

import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"

import type { TNativeTableStickyInsets } from "./stickyStyles"

type TBackend = { tableStickyPresentation: (encoded: string) => string }
type TConnectedView = View & { readonly isConnected?: boolean; readonly ownerDocument?: object | null }
type TCapture = {
  target: View
  root: View
  targetTag: number
  rootTag: number
  document: object
  configuration: string
  lease: string
  backend: TBackend
  released: boolean
}
let sequence = 0
const failure = (message: string) => new Error(`Table sticky header: ${message}`)
const tagOf = (view: View) => {
  const tag = findNodeHandle(view)
  if (!Number.isInteger(tag) || !tag || tag < 1 || tag > 2147483647) throw failure("actual native tag required")
  return tag
}

// This owns a registration, never a JavaScript scroll-position substitute.
export const createNativeTableStickyBinding = (
  target: () => View | null,
  root: () => View | null,
  isCurrent: () => boolean,
  environment: () => {
    backgroundColor: ColorValue
    session: { scopeOwnerId: string; windowId: string; epoch: number } | null
  },
) => {
  const owner = `native-table-sticky:${++sequence}`
  let current: TCapture | undefined
  let disposed = false
  const connected = (capture: TCapture) => {
    try {
      const view = capture.target as TConnectedView
      const table = capture.root as TConnectedView
      return (
        !disposed &&
        isCurrent() &&
        target() === capture.target &&
        root() === capture.root &&
        view.isConnected === true &&
        table.isConnected === true &&
        view.ownerDocument === capture.document &&
        table.ownerDocument === capture.document &&
        tagOf(view) === capture.targetTag &&
        tagOf(table) === capture.rootTag
      )
    } catch {
      return false
    }
  }
  const release = () => {
    const capture = current
    current = undefined
    if (!capture || capture.released) return
    const result: unknown = JSON.parse(
      capture.backend.tableStickyPresentation(JSON.stringify({ action: "release", owner, lease: capture.lease })),
    )
    if (
      !result ||
      typeof result !== "object" ||
      (result as Record<string, unknown>).lease !== capture.lease ||
      (result as Record<string, unknown>).released !== true
    )
      throw failure("invalid release acknowledgement")
    capture.released = true
  }
  return {
    synchronize: (enabled: boolean, insets: TNativeTableStickyInsets, rendererRequiresStyleAuthority: boolean) => {
      if (!enabled || !isCurrent() || disposed) {
        release()
        return
      }
      const { backgroundColor, session } = environment()
      const processedBackground = processColor(backgroundColor)
      if (processedBackground == null) throw failure("native background color required")
      const configuration = JSON.stringify({
        insets,
        rendererRequiresStyleAuthority,
        backgroundColor: processedBackground,
        session,
      })
      if (current && connected(current) && current.configuration === configuration) {
        const response: unknown = JSON.parse(
          current.backend.tableStickyPresentation(JSON.stringify({ action: "check", owner, lease: current.lease })),
        )
        if (
          !response ||
          typeof response !== "object" ||
          (response as Record<string, unknown>).owner !== owner ||
          (response as Record<string, unknown>).lease !== current.lease ||
          typeof (response as Record<string, unknown>).current !== "boolean"
        )
          throw failure("invalid current-lease acknowledgement")
        if ((response as Record<string, unknown>).current) return
      }
      release()
      const view = target() as TConnectedView | null
      const table = root() as TConnectedView | null
      if (!view || !table) return
      const document = view.ownerDocument
      if (view.isConnected !== true || table.isConnected !== true || !document || table.ownerDocument !== document)
        throw failure("connected original column and Table refs in one document required")
      const backend = TurboModuleRegistry.get<Spec & Partial<TBackend>>("CUIMotionSnapshot")
      if (!backend || typeof backend.tableStickyPresentation !== "function")
        throw failure("native presentation binding unavailable")
      const targetTag = tagOf(view),
        rootTag = tagOf(table),
        requestId = `${owner}:${++sequence}`
      const result: unknown = JSON.parse(
        backend.tableStickyPresentation(
          JSON.stringify({
            action: "register",
            owner,
            requestId,
            target: targetTag,
            containingRoot: rootTag,
            insets,
            backgroundColor: processedBackground,
            session,
            rendererRequiresStyleAuthority,
          }),
        ),
      )
      if (!result || typeof result !== "object") throw failure("invalid registration response")
      const response = result as Record<string, unknown>
      if (
        response.owner !== owner ||
        response.requestId !== requestId ||
        response.target !== targetTag ||
        response.containingRoot !== rootTag ||
        typeof response.lease !== "string" ||
        !response.lease ||
        response.registered !== true
      )
        throw failure("invalid registration acknowledgement")
      current = {
        target: view,
        root: table,
        targetTag,
        rootTag,
        document,
        configuration,
        lease: response.lease,
        backend: backend as TBackend,
        released: false,
      }
      if (!connected(current)) release()
    },
    retireIfChanged: () => {
      if (current && !connected(current)) release()
    },
    dispose: () => {
      disposed = true
      release()
    },
  }
}
