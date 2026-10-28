import { act, renderHook } from "@testing-library/react-native"
import { useRef } from "react"
import { findNodeHandle, type View } from "react-native"

import { dispatchNativeActivationPolicy } from "../../../input/activation"
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
} from "../hooks"
import type { TNativeDragAndDropOptions } from "../hooks"
import { nativeDragFormatter } from "../messages"
import { nativeDragRuntime } from "../runtime"
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
const view = () => ({ dragTestTag: ++tag }) as unknown as View
beforeEach(() => {
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((view: unknown) => (view as { dragTestTag: number } | null)?.dragTestTag ?? null)
})
afterEach(async () => {
  await nativeVirtualDrag.cancel()
  jest.restoreAllMocks()
})
const setup = async (options: TNativeDragAndDropOptions = {}, selected = new Set<string | number>([0])) => {
  const scope = createNativeKeyScope("owner"),
    actions = createNativeDragActions(scope)
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
  expect(response).toEqual({ operation: "copy" })
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
  let consumed = false
  await act(async () => {
    consumed = dispatchNativeActivationPolicy(child, {
      nativeEvent: { target: findNodeHandle(child), scopeOwnerId: "owner", windowId: "window", epoch: 1 },
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
