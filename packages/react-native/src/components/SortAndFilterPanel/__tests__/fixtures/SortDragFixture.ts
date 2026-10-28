import { findNodeHandle, type View } from "react-native"

import type { TNativeDragRect } from "../../../../collection/dragAndDrop/geometry"
import { createNativeKeyScope } from "../../../../input/keyScope"
import { createNativeDragActions } from "../../../../input/nativeDragActions"
import type { TNativeDragActionIdentity, TNativeDragMemberBinding } from "../../../../input/nativeDragActions"
import NativeModule from "../../../../input/specs/NativeCUIDragAndDrop"

type TMetadata = {
  bindingId: string
  revision: string
  rootTarget: number
  members: TNativeDragMemberBinding[]
}
type TFrame = { encoded: string; token: number; binding: string }

// Explicit synthetic native inputs for the existing Sort scene. No native
// geometry, input/default dispatch, URI, focus or installed proof is implied.
export const createSortDragFixture = (views: Map<string, View>) => {
  const keyboard = createNativeKeyScope("sort-drag-owner"),
    actions = createNativeDragActions(keyboard),
    native = NativeModule as jest.Mocked<NonNullable<typeof NativeModule>>,
    rectangles = new WeakMap<View, () => TNativeDragRect>(),
    properties = new WeakMap<View, () => object>()
  let serial = 0,
    geometryRevision = 0,
    liveToken = 0,
    latestToken = 0,
    session = "sort-session"
  const transfers = new Map<string, { handle: string; kind: "text"; types: string[] }[]>()
  keyboard.acceptNativeStatus({
    ownerId: keyboard.ownerId,
    windowId: "sort-window",
    epoch: 1,
    policyRevision: keyboard.policyRevision(),
    ready: false,
    windowActive: true,
  })
  actions.acceptStatus(
    JSON.stringify({
      kind: "window",
      ownerId: keyboard.ownerId,
      windowId: "sort-window",
      epoch: 1,
      surfaceId: 1,
      scopeTarget: 10,
      available: true,
      canLift: true,
      canDrop: true,
    }),
  )
  const metadata = (): TMetadata => {
    const value = JSON.parse(actions.bindings())[0] as TMetadata | undefined
    if (!value) throw new Error("Original Sort drag owner is unavailable")
    return value
  }
  const viewFor = (tag: number) => {
    const view = [...views.values()].find((view) => findNodeHandle(view) === tag)
    if (!view) throw new Error("Original Sort native ref is unavailable")
    return view
  }
  const rectangleFallback = (view: View): TNativeDragRect => {
    const props = (properties.get(view)?.() ?? {}) as Record<string, unknown>,
      semantics = typeof props.nativeCollectionSemantics === "string" ? JSON.parse(props.nativeCollectionSemantics) : {}
    return {
      x: 0,
      y: semantics.kind === "list-item" ? semantics.ordinal * 100 : 0,
      width: 200,
      height: semantics.kind === "list-item" ? 80 : 300,
    }
  }
  const rectangle = (view: View): TNativeDragRect => rectangles.get(view)?.() ?? rectangleFallback(view)
  const bind = (view: View, props: () => object) => {
    properties.set(view, props)
    Object.defineProperties(view, {
      getBoundingClientRect: { configurable: true, value: () => rectangle(view) },
      clientLeft: { configurable: true, value: 0 },
      clientTop: { configurable: true, value: 0 },
      scrollLeft: { configurable: true, value: 0 },
      scrollTop: { configurable: true, value: 0 },
      clientWidth: { configurable: true, get: () => rectangle(view).width },
      clientHeight: { configurable: true, get: () => rectangle(view).height },
      scrollWidth: { configurable: true, get: () => rectangle(view).width },
      scrollHeight: { configurable: true, get: () => rectangle(view).height },
    })
  }
  const geometry = () => {
    const data = metadata()
    return {
      revision: ++geometryRevision,
      root: rectangle(viewFor(data.rootTarget)),
      items: data.members.map((member) => ({
        ...member,
        rect: rectangle(viewFor(member.targetTag)),
        handleRect: member.handleTag ? rectangle(viewFor(member.handleTag)) : undefined,
      })),
    }
  }
  const ready = () => {
    for (const data of JSON.parse(actions.bindings()) as TMetadata[])
      actions.acceptStatus(
        JSON.stringify({
          kind: "binding",
          ownerId: keyboard.ownerId,
          windowId: "sort-window",
          epoch: 1,
          moduleId: "sort-native-module",
          ...data,
          ready: true,
          error: "",
        }),
      )
  }
  native.acceptsAction.mockImplementation((encoded) => JSON.parse(encoded).token === liveToken && liveToken > 0)
  native.settleAction.mockReturnValue(true)
  native.readGeometry.mockImplementation(async (encoded) => {
    const request = JSON.parse(encoded)
    return JSON.stringify({ ...request, geometry: geometry() })
  })
  native.readItems.mockImplementation(async (encoded) =>
    JSON.stringify(transfers.get(JSON.parse(encoded).handle) ?? []),
  )
  native.adoptItems.mockReturnValue(true)
  const frame = (
    kind: TNativeDragActionIdentity["kind"],
    x: number,
    y: number,
    key = "",
    extra: object = {},
  ): TFrame => {
    ready()
    const data = metadata(),
      member = data.members.find((member) => member.key === `string:${key}` && member.role !== "target")
    if (kind === "lift") session = `sort-session:${++serial}`
    const token = ++serial
    latestToken = token
    return {
      token,
      binding: JSON.stringify(data),
      encoded: JSON.stringify({
        version: 1,
        token,
        identity: {
          moduleId: "sort-native-module",
          ownerId: keyboard.ownerId,
          bindingId: data.bindingId,
          revision: data.revision,
          rootTarget: data.rootTarget,
          itemTarget: kind === "lift" ? member?.targetTag : 0,
          windowId: "sort-window",
          epoch: 1,
          surfaceId: 1,
          scopeTarget: 10,
          sessionId: session,
          kind,
        },
        payload: {
          x,
          y,
          key: member?.key,
          instanceId: member?.instanceId,
          geometry: geometry(),
          types: ["text/plain"],
          operations: ["copy", "move", "link"],
          ...extra,
        },
      }),
    }
  }
  const dispatch = (value: TFrame) => {
    liveToken = value.token === latestToken && value.binding === JSON.stringify(metadata()) ? value.token : 0
    try {
      return actions.dispatch(value.encoded) as Record<string, unknown>
    } finally {
      liveToken = 0
    }
  }
  const send = (kind: TNativeDragActionIdentity["kind"], x: number, y: number, key = "", extra: object = {}) =>
    dispatch(frame(kind, x, y, key, extra))
  const lift = (x: number, y: number, key = "") => send("lift", x, y, key)
  const move = (x: number, y: number) => {
    send("move", x, y)
    return send("target", x, y)
  }
  const drop = (x: number, y: number) => {
    const handle = `sort-native-module:transfer:${++serial}`
    transfers.set(handle, [{ kind: "text", handle: `${handle}:item`, types: ["text/plain"] }])
    const response = send("drop", x, y, "", { dataHandle: handle })
    if (!response.accepted) native.releaseData(JSON.stringify({ moduleId: "sort-native-module", handle }))
    send("end", x, y, "", { operation: response.accepted ? response.operation : "cancel" })
    return response
  }
  return {
    actions,
    keyboard,
    native,
    bind,
    ready,
    geometry,
    metadata,
    rectangle,
    rectangleFallback,
    frame,
    dispatch,
    send,
    lift,
    move,
    drop,
    expireFrames: () => {
      latestToken = 0
    },
    setRect: (view: View, value: TNativeDragRect | (() => TNativeDragRect)) =>
      rectangles.set(view, typeof value === "function" ? value : () => value),
    cancel: () => send("end", 0, 0, "", { operation: "cancel" }),
    dispose: () => actions.dispose(),
  }
}
