import { act, renderHook } from "@testing-library/react-native"
import { useInsertionEffect, useRef } from "react"
import { findNodeHandle, type View } from "react-native"

import { dispatchNativeActivationPolicy } from "../../../input/activation"
import { observeNativeFocus, registerNativeFocusTarget } from "../../../input/focus"
import { createNativeKeyScope } from "../../../input/keyScope"
import { NativeDragActionsContext, createNativeDragActions } from "../../../input/nativeDragActions"
import type { TNativeDragActionIdentity, TNativeDragMemberBinding } from "../../../input/nativeDragActions"
import { SelectionManager } from "../../state/SelectionManager"
import { useMultipleSelectionState } from "../../state/useMultipleSelectionState"
import {
  nativeDragRootFor,
  useNativeCollectionDragAndDrop,
  useNativeDragAndDrop,
  useNativeDraggableItem,
  useNativeDroppableItem,
} from "../hooks"
import type { TNativeDragAndDropOptions } from "../hooks"
import { nativeDragFormatter } from "../messages"
import { nativeDragRuntime } from "../runtime"
import type { TNativeDragPreviewRenderer } from "../types"
import { nativeVirtualDrag } from "../virtualDrag"

import { dragCollection, dragValues } from "./fixtures"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    acceptsAction: jest.fn(() => true),
    settleAction: jest.fn(() => true),
    readGeometry: jest.fn(),
  },
}))
// Synthetic original-view identities and native packets prove source routing only.
let tag = 100
const view = () =>
  ({ dragTestTag: ++tag, getBoundingClientRect: () => ({ x: 100, y: 200, width: 100, height: 30 }) }) as unknown as View
beforeEach(() => {
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((view: unknown) => (view as { dragTestTag: number } | null)?.dragTestTag ?? null)
})
afterEach(async () => {
  await nativeVirtualDrag.cancel()
  jest.restoreAllMocks()
})
const setup = async (
  options: TNativeDragAndDropOptions = {},
  selected = new Set<string | number>([0]),
  preview?: TNativeDragPreviewRenderer,
) => {
  const scope = createNativeKeyScope("owner"),
    actions = createNativeDragActions(scope)
  scope.acceptNativeStatus({
    ownerId: "owner",
    windowId: "window",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: false,
    windowActive: true,
  })
  actions.acceptStatus(
    JSON.stringify({
      kind: "window",
      ownerId: "owner",
      windowId: "window",
      epoch: 1,
      surfaceId: 1,
      scopeTarget: 10,
      available: true,
      canLift: true,
      canDrop: true,
    }),
  )
  const collection = dragCollection(),
    original = view()
  const rendered = await renderHook(
    () => {
      const root = useRef<View | null>(original)
      const manager = new SelectionManager(
        collection,
        useMultipleSelectionState({ selectionMode: "multiple", defaultSelectedKeys: selected }),
      )
      const { dragAndDropHooks } = useNativeDragAndDrop(options)
      const result = useNativeCollectionDragAndDrop({
        hooks: dragAndDropHooks,
        collection,
        selectionManager: manager,
        root,
        current: () => true,
      })
      useInsertionEffect(() => {
        if (preview) result.dragState.preview = { current: preview }
      })
      const draggable = useNativeDraggableItem({ key: 0, hasDragButton: true }, result.dragState)
      return { ...result, draggable, original: root, binding: nativeDragRootFor(root, actions)! }
    },
    {
      wrapper: ({ children }) => (
        <NativeDragActionsContext.Provider value={actions}>{children}</NativeDragActionsContext.Provider>
      ),
    },
  )
  let token = 0,
    geometryRevision = 0
  const metadata = () => JSON.parse(actions.bindings())[0]
  const ready = () =>
    actions.acceptStatus(
      JSON.stringify({
        kind: "binding",
        ownerId: "owner",
        windowId: "window",
        epoch: 1,
        moduleId: "native-module",
        bindingId: metadata().bindingId,
        revision: metadata().revision,
        rootTarget: metadata().rootTarget,
        ready: true,
        error: "",
      }),
    )
  const row = async (key: string | number, source = view(), target = source) => {
    await act(() => {
      rendered.result.current.binding.member(key, {}, source, "source")
      rendered.result.current.binding.member(key, {}, target, "target")
    })
    ready()
    return { source, target }
  }
  const packet = (kind: TNativeDragActionIdentity["kind"], values: object = {}, key: string | number = 0) => {
    const data = metadata(),
      member =
        data.members.find(
          (member: TNativeDragMemberBinding) =>
            member.key === `${typeof key === "number" ? "number" : "string"}:${key}` && member.role !== "target",
        ) ?? data.members[0]
    const identity = {
      moduleId: "native-module",
      ownerId: "owner",
      bindingId: data.bindingId,
      revision: data.revision,
      rootTarget: data.rootTarget,
      itemTarget: kind === "lift" ? member.targetTag : 0,
      windowId: "window",
      epoch: 1,
      surfaceId: 1,
      scopeTarget: 10,
      sessionId: "session",
      kind,
    }
    return JSON.stringify({
      version: 1,
      token: ++token,
      identity,
      payload: {
        x: 110,
        y: 215,
        key: member.key,
        instanceId: member.instanceId,
        geometry: {
          revision: ++geometryRevision,
          root: { x: 100, y: 200, width: 100, height: 200 },
          items: data.members.map((member: TNativeDragMemberBinding) => ({
            ...member,
            rect: {
              x: 100,
              y: 200 + ["number:0", "string:", "string:folder", "string:child"].indexOf(member.key) * 30,
              width: 100,
              height: 30,
            },
          })),
        },
        ...values,
      },
    })
  }
  return { rendered, actions, metadata, row, packet, ready, original }
}
it("routes actual committed collection state and original values through an authenticated lift/move/end", async () => {
  const trace: unknown[] = []
  const fixture = await setup({
    getItems: (keys, values) => {
      trace.push(["items", [...keys], values])
      return [{ "text/plain": "", "application/x-codon": "original" }]
    },
    onDragStart: () => trace.push("start"),
    onDragMove: () => trace.push("move"),
    onDragEnd: (event) => trace.push(["end", event.dropOperation, event.isInternal]),
  })
  await fixture.row(0)
  let response: unknown
  await act(() => {
    response = fixture.actions.dispatch(fixture.packet("lift"))
  })
  expect(response).toMatchObject({
    items: [
      [
        { type: "text/plain", data: "" },
        { type: "application/x-codon", data: "original" },
      ],
    ],
  })
  expect(trace).toEqual(["start", ["items", [0], [dragValues[0]]]])
  expect(fixture.rendered.result.current.dragState.isDragging(0)).toBe(true)
  await act(() => {
    fixture.actions.dispatch(fixture.packet("move"))
    fixture.actions.dispatch(fixture.packet("end", { operation: "copy" }))
  })
  expect(trace.slice(-2)).toEqual(["move", ["end", "copy", false]])
  expect(fixture.rendered.result.current.dragState.draggingKeys.size).toBe(0)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("keeps distinct caller source/drop refs with separate original native members and one typed key", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop: () => {} })
  const original = await fixture.row(0, view(), view())
  const members = fixture.metadata().members
  expect(members.map((member: TNativeDragMemberBinding) => [member.role, member.targetTag])).toEqual([
    ["source", findNodeHandle(original.source)],
    ["target", findNodeHandle(original.target)],
  ])
  expect(fixture.rendered.result.current.binding.rowView(0)).toBe(original.source)
  await act(() => {
    fixture.actions.dispatch(fixture.packet("lift"))
  })
  expect(fixture.rendered.result.current.dragState.draggedKey).toBe(0)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("uses root-relative pointer coordinates while retaining original window-space geometry", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop: () => {} })
  await fixture.row(0)
  await fixture.row("")
  await fixture.row("folder")
  await fixture.row("child")
  await act(() => {
    fixture.actions.dispatch(fixture.packet("lift"))
  })
  let response: unknown
  await act(() => {
    response = fixture.actions.dispatch(
      fixture.packet("target", { x: 110, y: 245, types: ["text/plain"], operations: ["copy"] }),
    )
  })
  expect(response).toEqual({
    operation: "copy",
    target: {
      ...fixture.metadata().members.find((member: TNativeDragMemberBinding) => member.key === "string:"),
      position: "on",
      activate: false,
    },
  })
  expect(fixture.rendered.result.current.dropState.target).toEqual({ type: "item", key: "", dropPosition: "on" })
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("emits one source-end on actual root unmount and does not synthesize an end on window retirement", async () => {
  const end = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragEnd: end })
  await fixture.row(0)
  await act(() => {
    fixture.actions.dispatch(fixture.packet("lift"))
  })
  await fixture.rendered.unmount()
  expect(end).toHaveBeenCalledTimes(1)
  expect(end.mock.calls[0][0]).toMatchObject({ dropOperation: "cancel", isInternal: false })
  fixture.actions.dispose()
  const retired = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragEnd: end })
  await retired.row(0)
  await act(() => {
    retired.actions.dispatch(retired.packet("lift"))
    retired.actions.acceptStatus(
      JSON.stringify({
        kind: "window",
        ownerId: "owner",
        windowId: "window",
        epoch: 2,
        surfaceId: 1,
        scopeTarget: 10,
        available: false,
        canLift: false,
        canDrop: false,
      }),
    )
  })
  await retired.rendered.unmount()
  retired.actions.dispose()
  expect(end).toHaveBeenCalledTimes(1)
})
it("retains every dragging key and the original zero/empty target key in virtualized persistence", async () => {
  const fixture = await setup(
    { getItems: () => [{ "text/plain": "selected" }], onItemDrop: () => {} },
    new Set([0, ""]),
  )
  await fixture.row(0)
  await act(() => {
    fixture.actions.dispatch(fixture.packet("lift"))
  })
  expect([...fixture.rendered.result.current.persistedKeys]).toEqual([0, ""])
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("requires native lift eligibility and quietly retires the virtual session with its original window", async () => {
  const end = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragEnd: end })
  await fixture.row(0)
  const measure = jest
    .spyOn(fixture.rendered.result.current.binding, "measure")
    .mockResolvedValue({ x: 100, y: 200, width: 100, height: 30 })
  fixture.actions.acceptStatus(
    JSON.stringify({
      kind: "window",
      ownerId: "owner",
      windowId: "window",
      epoch: 1,
      surfaceId: 1,
      scopeTarget: 10,
      available: true,
      canLift: false,
      canDrop: true,
    }),
  )
  await act(async () => {
    await nativeVirtualDrag.start(fixture.rendered.result.current.binding, 0, nativeDragFormatter("en-US"), "virtual")
  })
  expect(measure).not.toHaveBeenCalled()
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  fixture.actions.acceptStatus(
    JSON.stringify({
      kind: "window",
      ownerId: "owner",
      windowId: "window",
      epoch: 1,
      surfaceId: 1,
      scopeTarget: 10,
      available: true,
      canLift: true,
      canDrop: true,
    }),
  )
  await act(async () => {
    await nativeVirtualDrag.start(fixture.rendered.result.current.binding, 0, nativeDragFormatter("en-US"), "virtual")
  })
  expect(nativeVirtualDrag.isDragging()).toBe(true)
  await act(() =>
    fixture.actions.acceptStatus(
      JSON.stringify({
        kind: "window",
        ownerId: "owner",
        windowId: "window",
        epoch: 2,
        surfaceId: 1,
        scopeTarget: 10,
        available: false,
        canLift: false,
        canDrop: false,
      }),
    ),
  )
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  expect(fixture.rendered.result.current.dragState.draggingKeys.size).toBe(0)
  expect(end).not.toHaveBeenCalled()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("starts from the original handle rectangle, preserves keyboard modality and ends cancellation at that handle", async () => {
  const onDragStart = jest.fn(),
    onDragEnd = jest.fn()
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragStart, onDragEnd })
  await fixture.row(0)
  const handle = view()
  await act(() => fixture.rendered.result.current.binding.handle(0, handle))
  fixture.ready()
  const info = jest.requireActual<typeof import("react-native")>("react-native").AccessibilityInfo
  const announce = jest.spyOn(info, "announceForAccessibilityWithOptions").mockImplementation(() => {})
  const frames: (() => void)[] = []
  jest.spyOn(nativeDragRuntime, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(() => callback(0))
    return frames.length
  })
  const native = jest.requireMock("../../../input/specs/NativeCUIDragAndDrop").default
  native.readGeometry.mockImplementation(async (request: string) => {
    const identity = JSON.parse(request),
      member = fixture.metadata().members[0]
    return JSON.stringify({
      requestId: identity.requestId,
      windowId: "window",
      epoch: 1,
      geometry: {
        root: { x: 100, y: 200, width: 100, height: 100 },
        items: [
          {
            ...member,
            rect: { x: 100, y: 200, width: 100, height: 30 },
            handleTag: findNodeHandle(handle),
            handleRect: { x: 110, y: 210, width: 12, height: 12 },
          },
        ],
      },
    })
  })
  await act(async () => {
    fixture.rendered.result.current.draggable.dragButtonProps.onPress?.({
      nativeEvent: { kind: "keyboard", key: "Enter" },
    } as never)
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ x: 116, y: 216 }))
  expect(nativeVirtualDrag.active()?.sourceView).toBe(handle)
  await act(() => {
    for (const frame of frames.splice(0)) frame()
  })
  expect(announce).toHaveBeenCalledWith(nativeDragFormatter("en-US").format("dragStartedKeyboard"), { queue: false })
  await act(async () => {
    await nativeVirtualDrag.cancel()
  })
  expect(onDragEnd).toHaveBeenCalledWith(expect.objectContaining({ x: 116, y: 216, dropOperation: "cancel" }))
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("uses collection-centre coordinates for virtual activation/drop and admits one terminal drop", async () => {
  const onDropActivate = jest.fn(),
    onItemDrop = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop, onDropActivate })
  await fixture.row(0)
  await fixture.row("")
  const binding = fixture.rendered.result.current.binding
  jest
    .spyOn(binding, "measure")
    .mockImplementation(async (key) =>
      key == null ? { x: 10, y: 20, width: 100, height: 80 } : { x: 100, y: 200, width: 30, height: 30 },
    )
  await act(async () => {
    await nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual")
  })
  await act(() => {
    nativeVirtualDrag.choose(binding, { type: "item", key: "", dropPosition: "on" })
  })
  await act(async () => {
    await nativeVirtualDrag.activate()
  })
  expect(onDropActivate).toHaveBeenCalledWith(
    expect.objectContaining({ x: 60, y: 60, target: { type: "item", key: "", dropPosition: "on" } }),
  )
  await act(async () => {
    await Promise.all([nativeVirtualDrag.drop(), nativeVirtualDrag.drop()])
  })
  expect(onItemDrop).toHaveBeenCalledTimes(1)
  expect(onItemDrop.mock.calls[0][0].target.key).toBe("")
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("routes an original accessibility activation through its target before another control's default", async () => {
  const onItemDrop = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop })
  await fixture.row(0)
  await fixture.row("")
  const binding = fixture.rendered.result.current.binding,
    item = view(),
    child = view(),
    owner = {}
  Object.assign(item, { childNodes: [child] })
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 100, height: 80 })
  nativeVirtualDrag.endpoint(owner, {
    root: binding,
    target: { type: "item", key: "", dropPosition: "on" },
    view: () => item,
    activate: () => null,
  })
  await act(async () => {
    await nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual")
  })
  jest.spyOn(fixture.actions, "activationSession").mockReturnValue({ windowId: "window", epoch: 9 })
  expect(fixture.actions.window().epoch).toBe(1)
  expect(
    dispatchNativeActivationPolicy(child, {
      nativeEvent: { target: findNodeHandle(child), scopeOwnerId: "owner", windowId: "window", epoch: 8 },
    } as never),
  ).toBe(true)
  expect(onItemDrop).not.toHaveBeenCalled()
  let consumed = false
  await act(async () => {
    consumed = dispatchNativeActivationPolicy(child, {
      nativeEvent: { target: findNodeHandle(child), scopeOwnerId: "owner", windowId: "window", epoch: 9 },
    } as never)
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(consumed).toBe(true)
  expect(onItemDrop).toHaveBeenCalledTimes(1)
  expect(
    dispatchNativeActivationPolicy(child, {
      nativeEvent: { target: findNodeHandle(child), scopeOwnerId: "owner", windowId: "window", epoch: 1 },
    } as never),
  ).toBe(false)
  nativeVirtualDrag.endpoint(owner, null)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("returns the actual hover target identity, avoids duplicate entry work and refuses a stale activation target", async () => {
  const onDropActivate = jest.fn(),
    onDropEnter = jest.fn(),
    fixture = await setup({
      getItems: () => [{ "text/plain": "zero" }],
      onItemDrop: () => {},
      onDropActivate,
      onDropEnter,
    })
  await fixture.row(0)
  await fixture.row("")
  await fixture.row("folder")
  await fixture.row("child")
  let response:
    | { operation: string; target: TNativeDragMemberBinding & { position: string; activate: boolean } }
    | undefined
  await act(() => {
    fixture.actions.dispatch(fixture.packet("lift"))
  })
  await act(() => {
    response = fixture.actions.dispatch(
      fixture.packet("target", { x: 110, y: 245, types: ["text/plain"], operations: ["copy"] }),
    ) as typeof response
  })
  expect(response!.target).toMatchObject({
    key: "string:",
    targetTag: fixture.metadata().members.find((member: TNativeDragMemberBinding) => member.key === "string:")
      .targetTag,
    position: "on",
    activate: true,
  })
  const revision = fixture.rendered.result.current.binding.controller.snapshot()
  await act(() => {
    fixture.actions.dispatch(fixture.packet("target", { x: 110, y: 245, types: ["text/plain"], operations: ["copy"] }))
  })
  expect(fixture.rendered.result.current.binding.controller.snapshot()).toBe(revision)
  expect(onDropEnter).toHaveBeenCalledTimes(1)
  await act(() => {
    expect(
      fixture.actions.dispatch(
        fixture.packet("activate", { expectedTarget: { ...response!.target, key: "number:0" } }),
      ),
    ).toEqual({ activated: false })
  })
  expect(onDropActivate).not.toHaveBeenCalled()
  await act(() => {
    fixture.actions.dispatch(fixture.packet("activate", { expectedTarget: response!.target }))
  })
  expect(onDropActivate).toHaveBeenCalledTimes(1)
  expect(onDropActivate.mock.calls[0][0].target).toEqual({ type: "item", key: "", dropPosition: "on" })
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("retains the source root fallback when a custom point target rejects an external drop", async () => {
  const fixture = await setup({
    onRootDrop: () => {},
    dropTargetDelegate: { getDropTargetFromPoint: () => ({ type: "item", key: "folder", dropPosition: "on" }) },
  })
  await fixture.row(0)
  let response: unknown
  await act(() => {
    response = fixture.actions.dispatch(fixture.packet("target", { types: ["text/plain"], operations: ["copy"] }))
  })
  expect(response).toEqual({ operation: "copy", target: null })
  expect(fixture.rendered.result.current.dropState.target).toEqual({ type: "root" })
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("rotates collection navigation from the nearest original handle, retaining registration-order ties and source cancellation", async () => {
  const first = await setup({ onItemDrop: () => {} }),
    second = await setup({ onItemDrop: () => {} }),
    source = await setup({ getItems: () => [{ "text/plain": "zero" }] })
  await source.row(0)
  const handle = view()
  Object.assign(handle, { getBoundingClientRect: () => ({ x: 10, y: 20, width: 12, height: 12 }) })
  Object.assign(first.original, { getBoundingClientRect: () => ({ x: 10, y: 50, width: 100, height: 100 }) })
  Object.assign(second.original, { getBoundingClientRect: () => ({ x: 10, y: 25, width: 100, height: 100 }) })
  const binding = source.rendered.result.current.binding
  await act(() => binding.handle(0, handle))
  source.ready()
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 12, height: 12 })
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual", "handle"))
  await act(() => nativeVirtualDrag.cycle(1))
  expect(nativeVirtualDrag.active()?.root).toBe(second.rendered.result.current.binding)
  await act(() => nativeVirtualDrag.cycle(1))
  expect(nativeVirtualDrag.active()?.root).toBe(first.rendered.result.current.binding)
  await act(() => nativeVirtualDrag.cycle(1))
  expect(nativeVirtualDrag.active()?.root).toBeNull()
  await act(() => nativeVirtualDrag.cycle(-1))
  expect(nativeVirtualDrag.active()?.root).toBe(first.rendered.result.current.binding)
  Object.assign(first.original, { getBoundingClientRect: () => ({ x: 10, y: 25, width: 100, height: 100 }) })
  await act(() => nativeVirtualDrag.cycle(1))
  await act(() => nativeVirtualDrag.cycle(1))
  await act(() => nativeVirtualDrag.cycle(1))
  // Equal distances keep the first registered target at the start of the ring.
  expect(nativeVirtualDrag.active()?.root).toBe(first.rendered.result.current.binding)
  await act(async () => nativeVirtualDrag.cancel())
  for (const fixture of [first, second, source]) {
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  }
})

it("replaces a rejected target, retains independent scope epochs and refuses a foreign or disabled window", async () => {
  const firstOptions = { onItemDrop: () => {}, isDisabled: false }
  const first = await setup(firstOptions),
    second = await setup({ onItemDrop: () => {} }),
    source = await setup({ getItems: () => [{ "text/plain": "zero" }] })
  await source.row(0)
  const binding = source.rendered.result.current.binding
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 100, y: 200, width: 100, height: 30 })
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  await act(() => nativeVirtualDrag.cycle(1))
  expect(nativeVirtualDrag.active()?.root).toBe(first.rendered.result.current.binding)
  firstOptions.isDisabled = true
  await first.rendered.rerender(undefined)
  expect(nativeVirtualDrag.active()?.root).toBe(second.rendered.result.current.binding)
  const window = second.actions.window()
  jest.spyOn(second.actions, "window").mockReturnValue({ ...window, epoch: window.epoch + 1 })
  await act(() => nativeVirtualDrag.reconcile(second.rendered.result.current.binding))
  expect(nativeVirtualDrag.active()?.root).toBe(second.rendered.result.current.binding)
  jest.mocked(second.actions.window).mockReturnValue({ ...window, windowId: "foreign-window" })
  await act(() => nativeVirtualDrag.reconcile(second.rendered.result.current.binding))
  expect(nativeVirtualDrag.active()?.root).toBeNull()
  jest.mocked(second.actions.window).mockReturnValue({ ...window, canDrop: false })
  await act(() => nativeVirtualDrag.cycle(1))
  expect(nativeVirtualDrag.active()?.root).toBeNull()
  await act(async () => nativeVirtualDrag.cancel())
  for (const fixture of [first, second, source]) {
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  }
})

it.each(["missing", "nonfinite", "negative", "replacement"] as const)(
  "refuses %s original target geometry without selecting by registration as a fallback",
  async (kind) => {
    const target = await setup({ onItemDrop: () => {} }),
      source = await setup({ getItems: () => [{ "text/plain": "zero" }] })
    await source.row(0)
    const binding = source.rendered.result.current.binding
    jest.spyOn(binding, "measure").mockResolvedValue({ x: 100, y: 200, width: 100, height: 30 })
    await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
    Object.assign(target.original, {
      getBoundingClientRect:
        kind === "missing"
          ? undefined
          : () => {
              if (kind === "replacement") target.rendered.result.current.original.current = view()
              return { x: kind === "nonfinite" ? NaN : 0, y: 0, width: kind === "negative" ? -1 : 10, height: 10 }
            },
    })
    expect(() => nativeVirtualDrag.cycle(1)).toThrow(/rectangle|changed/)
    expect(nativeVirtualDrag.active()?.root).toBeNull()
    await act(async () => nativeVirtualDrag.cancel())
    for (const fixture of [target, source]) {
      await fixture.rendered.unmount()
      fixture.actions.dispose()
    }
  },
)

it("ignores a delayed authored preview from an ended session even when the next drag reuses its native session id", async () => {
  const callbacks: Parameters<TNativeDragPreviewRenderer>[1][] = [],
    preview: TNativeDragPreviewRenderer = (_items, callback) => {
      callbacks.push(callback)
    }
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }] }, undefined, preview)
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding
  await act(() => fixture.actions.dispatch(fixture.packet("lift")))
  const original = view()
  await act(() => callbacks[0](original, 4, 7))
  expect(fixture.metadata()).toMatchObject({ previewTarget: findNodeHandle(original), previewX: 4, previewY: 7 })
  await act(() => fixture.actions.dispatch(fixture.packet("end", { operation: "cancel" })))
  fixture.ready()
  await act(() => fixture.actions.dispatch(fixture.packet("lift")))
  const current = view()
  await act(() => callbacks[1](current, 8, 9))
  await act(() => callbacks[0](original, 100, 100))
  await act(() => callbacks[0](null))
  expect(fixture.metadata()).toMatchObject({ previewTarget: findNodeHandle(current), previewX: 8, previewY: 9 })
  // The imperative preview ref is detached before its layout cleanup runs.
  fixture.rendered.result.current.dragState.preview!.current = null
  await act(() => callbacks[1](original, 100, 100))
  expect(fixture.metadata().previewTarget).toBe(findNodeHandle(current))
  await act(() => callbacks[1](null))
  expect(fixture.metadata().previewTarget).toBe(0)
  await act(() => binding.retire())
  await act(() => callbacks[1](current, 1, 1))
  binding.publish()
  expect(fixture.metadata().previewTarget).toBe(0)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("selects the closest valid original endpoint when a descendant receives owned focus", async () => {
  const target = await setup({ onItemDrop: () => {} }),
    source = await setup({ getItems: () => [{ "text/plain": "zero" }] })
  await source.row(0)
  const binding = source.rendered.result.current.binding,
    parent = view(),
    nested = view(),
    child = view(),
    outerOwner = {},
    innerOwner = {}
  Object.assign(parent, { childNodes: [nested] })
  Object.assign(nested, { childNodes: [child] })
  nativeVirtualDrag.endpoint(outerOwner, {
    root: target.rendered.result.current.binding,
    target: { type: "item", key: 0, dropPosition: "on" },
    view: () => parent,
    activate: () => null,
  })
  nativeVirtualDrag.endpoint(innerOwner, {
    root: target.rendered.result.current.binding,
    target: { type: "item", key: "", dropPosition: "on" },
    view: () => nested,
    activate: () => null,
  })
  const unregister = registerNativeFocusTarget(child, { focus: () => {}, blur: () => {}, canFocus: () => true })
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 100, y: 200, width: 100, height: 30 })
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  await act(() => observeNativeFocus(child, true))
  expect(nativeVirtualDrag.active()?.root).toBe(target.rendered.result.current.binding)
  expect(nativeVirtualDrag.active()?.target).toEqual({ type: "item", key: "", dropPosition: "on" })
  await act(async () => nativeVirtualDrag.cancel())
  unregister()
  nativeVirtualDrag.endpoint(innerOwner, null)
  nativeVirtualDrag.endpoint(outerOwner, null)
  for (const fixture of [target, source]) {
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  }
})

it("ends the original virtual source exactly once when its actual drag handle unmounts", async () => {
  const onDragEnd = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragEnd })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding,
    handle = view()
  await act(() => binding.handle(0, handle))
  fixture.ready()
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 100, y: 200, width: 12, height: 12 })
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual", "handle"))
  await act(() => binding.handle(0, null))
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  expect(onDragEnd).toHaveBeenCalledTimes(1)
  expect(onDragEnd.mock.calls[0][0]).toMatchObject({ dropOperation: "cancel", isInternal: false })
  expect(fixture.rendered.result.current.dragState.draggingKeys.size).toBe(0)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
  expect(onDragEnd).toHaveBeenCalledTimes(1)
})

it("moves an original droppable item ref from zero to the empty key without retaining a ghost physical target", async () => {
  const fixture = await setup({ onItemDrop: () => {} }),
    original = view(),
    binding = fixture.rendered.result.current.binding
  const item = await renderHook(
    ({ itemKey }: { itemKey: string | number }) => {
      const ref = useRef<View | null>(original)
      return useNativeDroppableItem(
        { target: { type: "item", key: itemKey, dropPosition: "on" } },
        fixture.rendered.result.current.dropState,
        ref,
      )
    },
    { initialProps: { itemKey: 0 } },
  )
  expect(binding.targetView(0)).toBe(original)
  await item.rerender({ itemKey: "" })
  expect(binding.targetView(0)).toBeNull()
  expect(binding.targetView("")).toBe(original)
  expect(fixture.metadata().members.map((member: TNativeDragMemberBinding) => member.key)).toEqual(["string:"])
  await item.unmount()
  expect(binding.targetView("")).toBeNull()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("publishes original virtual focus refs, selects native observations without replaying focus and retires covered owners", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop: () => {} })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding,
    endpoint = view(),
    second = view(),
    firstOwner = {},
    secondOwner = {}
  nativeVirtualDrag.endpoint(firstOwner, {
    root: binding,
    target: { type: "item", key: "", dropPosition: "on" },
    view: () => endpoint,
    activate: () => null,
  })
  nativeVirtualDrag.endpoint(secondOwner, {
    root: binding,
    target: { type: "item", key: "folder", dropPosition: "on" },
    view: () => second,
    activate: () => null,
  })
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 100, height: 80 })
  let visible = true
  binding.configureVirtual(() => visible)
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  await act(() => nativeVirtualDrag.choose(binding, { type: "item", key: "", dropPosition: "on" }))
  const manifest = fixture.metadata().virtualFocus
  expect(manifest).toMatchObject({
    sessionId: nativeVirtualDrag.active()!.id,
    windowId: "window",
    epoch: 1,
    nativeSelection: true,
    source: { tag: findNodeHandle(binding.rowView(0)) },
    selected: { tag: findNodeHandle(endpoint) },
  })
  expect(manifest.targets.map((entry: { tag: number }) => entry.tag)).toEqual(
    expect.arrayContaining([findNodeHandle(endpoint), findNodeHandle(second)]),
  )
  const focus = jest.spyOn(
    jest.requireActual<typeof import("../../../input/focus")>("../../../input/focus"),
    "focusNativeTarget",
  )
  await act(() =>
    nativeVirtualDrag.observeNativeFocus(binding, nativeVirtualDrag.active()!.id, findNodeHandle(second)!),
  )
  expect(nativeVirtualDrag.active()!.target).toEqual({ type: "item", key: "folder", dropPosition: "on" })
  expect(focus).not.toHaveBeenCalled()
  await act(() => {
    visible = false
    binding.configureVirtual(() => visible)
    nativeVirtualDrag.reconcile(binding)
  })
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  nativeVirtualDrag.endpoint(firstOwner, null)
  nativeVirtualDrag.endpoint(secondOwner, null)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("issues one owned focus intent while its original endpoint awaits native observation", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop: () => {} })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding,
    endpoint = view(),
    owner = {},
    focus = jest.fn()
  const unregister = registerNativeFocusTarget(endpoint, { focus, blur: () => {}, canFocus: () => true })
  nativeVirtualDrag.endpoint(owner, {
    root: binding,
    target: { type: "item", key: "", dropPosition: "on" },
    view: () => endpoint,
    activate: () => null,
  })
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 100, height: 80 })
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  await act(() => nativeVirtualDrag.choose(binding, { type: "item", key: "", dropPosition: "on" }))
  await act(() => {
    for (let index = 0; index < 4; index++) {
      nativeVirtualDrag.focus(nativeVirtualDrag.active()!)
      binding.publish()
    }
  })
  expect(focus).toHaveBeenCalledTimes(1)
  expect(fixture.metadata().virtualFocus.nativeSelection).toBe(false)
  await act(async () => nativeVirtualDrag.cancel())
  unregister()
  nativeVirtualDrag.endpoint(owner, null)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("enrolls a root fallback without exposing unrelated original collection descendants", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onRootDrop: () => {} })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 100, height: 80 })
  await act(async () => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  await act(() => nativeVirtualDrag.choose(binding, { type: "root" }))
  expect(fixture.metadata().virtualFocus.selected).toMatchObject({
    tag: findNodeHandle(binding.root.current),
    descendants: false,
  })
  await act(async () => nativeVirtualDrag.cancel())
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
