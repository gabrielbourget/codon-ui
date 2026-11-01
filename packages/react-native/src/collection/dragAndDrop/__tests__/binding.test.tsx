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
import type { TNativePreparedDragPreview } from "../types"
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
  preview?: TNativePreparedDragPreview,
  layoutDelegate?: Parameters<typeof useNativeCollectionDragAndDrop>[0]["layoutDelegate"],
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
  const originalCollection = dragCollection()
  // This custom logical collection supplies an accessible label for its empty-string key.
  const collection = Object.create(originalCollection) as typeof originalCollection
  Object.defineProperty(collection, "getTextValue", {
    value: (key: string | number) => (key === "" ? "Empty" : (originalCollection.getItem(key)?.textValue ?? "")),
  })
  const original = view()
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
        layoutDelegate,
        rootLabel: "Collection",
      })
      useInsertionEffect(() => {
        if (preview) result.dragState.preparedDragPreview = preview
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
        metadataRevision: metadata().metadataRevision,
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
      metadataRevision: data.metadataRevision,
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

it("requires fresh lift eligibility before opening a chooser and cancels when the native window is replaced", async () => {
  const end = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragEnd: end })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding
  const measure = jest.spyOn(binding, "measure").mockResolvedValue({ x: 100, y: 200, width: 100, height: 30 })
  const original = fixture.actions.window()
  const window = jest.spyOn(fixture.actions, "window").mockReturnValue({ ...original, canLift: false })
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  expect(nativeVirtualDrag.pendingRequest()).toBeNull()
  window.mockReturnValue(original)
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  expect(nativeVirtualDrag.pendingRequest()?.sourceView).toBe(binding.rowView(0))
  expect(measure).not.toHaveBeenCalled()
  window.mockReturnValue({ ...original, windowId: "replacement-window" })
  await act(() => nativeVirtualDrag.reconcile(binding))
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  expect(fixture.rendered.result.current.dragState.draggingKeys.size).toBe(0)
  expect(end).not.toHaveBeenCalled()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("retains an original keyboard handle without measuring or starting payload work before confirmation", async () => {
  const onDragStart = jest.fn(),
    onDragEnd = jest.fn(),
    getItems = jest.fn(() => [{ "text/plain": "zero" }])
  const fixture = await setup({ getItems, onDragStart, onDragEnd })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding,
    handle = view()
  await act(() => binding.handle(0, handle))
  fixture.ready()
  const measure = jest.spyOn(binding, "measure")
  await act(() =>
    fixture.rendered.result.current.draggable.dragButtonProps.onPress?.({
      nativeEvent: { kind: "keyboard", key: "Enter" },
    } as never),
  )
  expect(nativeVirtualDrag.pendingRequest()?.sourceView).toBe(handle)
  expect(nativeVirtualDrag.active()).toBeNull()
  expect(measure).not.toHaveBeenCalled()
  expect(getItems).not.toHaveBeenCalled()
  expect(onDragStart).not.toHaveBeenCalled()
  await act(() => nativeVirtualDrag.cancel())
  expect(onDragEnd).not.toHaveBeenCalled()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("uses original collection-centre drop coordinates after dismissal and admits one terminal confirmation", async () => {
  const onItemDrop = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop })
  await fixture.row(0)
  await fixture.row("")
  const binding = fixture.rendered.result.current.binding
  jest
    .spyOn(binding, "measure")
    .mockImplementation(async (key) =>
      key == null ? { x: 10, y: 20, width: 100, height: 80 } : { x: 100, y: 200, width: 30, height: 30 },
    )
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  await act(() => nativeVirtualDrag.choose(binding, { type: "item", key: "", dropPosition: "on" }))
  await act(async () => {
    await Promise.all([nativeVirtualDrag.drop(), nativeVirtualDrag.drop()])
  })
  expect(onItemDrop).not.toHaveBeenCalled()
  const id = nativeVirtualDrag.pendingRequest()!.id
  await act(async () => {
    nativeVirtualDrag.dismissed(id)
    nativeVirtualDrag.dismissed(id)
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(onItemDrop).toHaveBeenCalledTimes(1)
  expect(onItemDrop.mock.calls[0][0]).toMatchObject({ target: { type: "item", key: "", dropPosition: "on" } })
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("does not install a generic descendant activation interceptor or publish native focus projection for a chooser", async () => {
  const onItemDrop = jest.fn(),
    fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop })
  await fixture.row(0)
  await fixture.row("")
  const binding = fixture.rendered.result.current.binding,
    child = view()
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  expect(fixture.metadata().virtualFocus).toBeUndefined()
  expect(
    dispatchNativeActivationPolicy(child, {
      nativeEvent: { target: findNodeHandle(child), scopeOwnerId: "owner", windowId: "window", epoch: 1 },
    } as never),
  ).toBe(false)
  expect(onItemDrop).not.toHaveBeenCalled()
  expect(binding.controller.activeSession()).toBeNull()
  await act(() => nativeVirtualDrag.cancel())
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

it("lists declared logical targets across collections without measuring descendants or calling payload getters", async () => {
  const first = await setup({ onItemDrop: () => {} }),
    second = await setup({ onItemDrop: () => {} })
  const getItems = jest.fn(() => [{ "text/plain": "zero" }])
  const source = await setup({ getItems })
  await source.row(0)
  const measure = jest.spyOn(source.rendered.result.current.binding, "measure")
  await act(() =>
    nativeVirtualDrag.start(source.rendered.result.current.binding, 0, nativeDragFormatter("en-US"), "virtual"),
  )
  const choices = nativeVirtualDrag.pendingRequest()!.choices
  expect(
    choices.some(
      (choice) =>
        choice.root === first.rendered.result.current.binding &&
        choice.target.type === "item" &&
        choice.target.key === 0,
    ),
  ).toBe(true)
  expect(
    choices.some(
      (choice) =>
        choice.root === second.rendered.result.current.binding &&
        choice.target.type === "item" &&
        choice.target.key === "",
    ),
  ).toBe(true)
  expect(choices.every((choice) => choice.label.trim().length > 0)).toBe(true)
  expect(measure).not.toHaveBeenCalled()
  expect(getItems).not.toHaveBeenCalled()
  await act(() => nativeVirtualDrag.cancel())
  for (const fixture of [first, second, source]) {
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  }
})

it.each(["disabled", "foreign", "replacement"])(
  "rejects a chosen %s custom collection without silently retargeting",
  async (kind) => {
    const options = { onItemDrop: jest.fn(), isDisabled: false }
    const target = await setup(options),
      source = await setup({ getItems: () => [{ "text/plain": "zero" }] })
    await source.row(0)
    const binding = source.rendered.result.current.binding,
      destination = target.rendered.result.current.binding
    await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
    await act(() => nativeVirtualDrag.choose(destination, { type: "item", key: "", dropPosition: "on" }))
    if (kind === "disabled") {
      options.isDisabled = true
      await target.rendered.rerender(undefined)
    } else if (kind === "replacement") target.rendered.result.current.original.current = view()
    else
      jest.spyOn(target.actions, "window").mockReturnValue({ ...target.actions.window(), windowId: "foreign-window" })
    await act(() => nativeVirtualDrag.reconcile(destination))
    expect(nativeVirtualDrag.pendingRequest()).toBeNull()
    expect(options.onItemDrop).not.toHaveBeenCalled()
    for (const fixture of [target, source]) {
      await fixture.rendered.unmount()
      fixture.actions.dispose()
    }
  },
)

it("publishes an already mounted preview before lift and preserves the original ref/hotspot across drag end", async () => {
  const original = view(),
    ref = { current: original },
    preview = { ref, x: 4, y: 7 }
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }] }, undefined, preview)
  await fixture.row(0)
  expect(fixture.metadata()).toMatchObject({ previewTarget: findNodeHandle(original), previewX: 4, previewY: 7 })
  const firstIdentity = fixture.metadata().previewInstanceId
  let response: unknown
  await act(() => {
    response = fixture.actions.dispatch(fixture.packet("lift"))
  })
  expect(response).toMatchObject({ previewExpected: true, items: [[{ type: "text/plain", data: "zero" }]] })
  expect(ref.current).toBe(original)
  await act(() => fixture.actions.dispatch(fixture.packet("end", { operation: "cancel" })))
  expect(fixture.metadata().previewInstanceId).toBe(firstIdentity)
  const replacement = view()
  ref.current = replacement
  await act(() => fixture.rendered.result.current.binding.publish())
  expect(fixture.metadata().previewTarget).toBe(findNodeHandle(replacement))
  expect(fixture.metadata().previewInstanceId).not.toBe(firstIdentity)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
it("retires custom preview admission after its prepared original ref detaches, without a source fallback", async () => {
  const ref = { current: view() as View | null }
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }] }, undefined, { ref })
  await fixture.row(0)
  const packet = fixture.packet("lift")
  ref.current = null
  await act(() => fixture.rendered.result.current.binding.publish())
  expect(JSON.parse(fixture.actions.bindings())).toEqual([])
  expect(() => fixture.actions.dispatch(packet)).toThrow(/authority/)
  expect(fixture.rendered.result.current.binding.controller.activeSession()).toBeNull()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("rejects a prepared preview replacement made inside onDragStart and retires the original session", async () => {
  const ref = { current: view() },
    old = ref.current
  const fixture = await setup(
    {
      getItems: () => [{ "text/plain": "zero" }],
      onDragStart: () => {
        ref.current = view()
      },
    },
    undefined,
    { ref },
  )
  await fixture.row(0)
  await act(() => {
    expect(() => fixture.actions.dispatch(fixture.packet("lift"))).toThrow(/prepared original changed/)
  })
  expect(ref.current).not.toBe(old)
  expect(fixture.rendered.result.current.binding.controller.activeSession()).toBeNull()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("keeps ordinary descendant focus independent while a chooser request is pending", async () => {
  const target = await setup({ onItemDrop: () => {} }),
    source = await setup({ getItems: () => [{ "text/plain": "zero" }] })
  await source.row(0)
  const binding = source.rendered.result.current.binding,
    child = view()
  const unregister = registerNativeFocusTarget(child, { focus: () => {}, blur: () => {}, canFocus: () => true })
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  const before = nativeVirtualDrag.pendingRequest()!.selected
  await act(() => observeNativeFocus(child, true))
  expect(nativeVirtualDrag.pendingRequest()!.selected).toBe(before)
  expect(nativeVirtualDrag.active()).toBeNull()
  unregister()
  await act(() => nativeVirtualDrag.cancel())
  for (const fixture of [target, source]) {
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  }
})

it("retires an unmounted original handle without fabricating start/end callbacks for a pending chooser", async () => {
  const onDragEnd = jest.fn(),
    onDragStart = jest.fn()
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDragEnd, onDragStart })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding,
    handle = view()
  await act(() => binding.handle(0, handle))
  fixture.ready()
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual", "handle"))
  await act(() => binding.handle(0, null))
  expect(nativeVirtualDrag.isDragging()).toBe(false)
  expect(onDragStart).not.toHaveBeenCalled()
  expect(onDragEnd).not.toHaveBeenCalled()
  expect(fixture.rendered.result.current.dragState.draggingKeys.size).toBe(0)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
  expect(onDragEnd).not.toHaveBeenCalled()
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

it("retains declared custom target labels without exposing a native focus manifest", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onItemDrop: () => {} })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding,
    owner = {},
    endpoint = view()
  nativeVirtualDrag.endpoint(owner, {
    root: binding,
    target: { type: "item", key: "", dropPosition: "on" },
    view: () => endpoint,
    activate: () => null,
    label: () => "Explicit custom destination",
  })
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  expect(
    nativeVirtualDrag.pendingRequest()!.choices.some((choice) => choice.label === "Explicit custom destination"),
  ).toBe(true)
  expect(fixture.metadata().virtualFocus).toBeUndefined()
  expect(binding.controller.activeSession()).toBeNull()
  nativeVirtualDrag.endpoint(owner, null)
  await act(() => nativeVirtualDrag.cancel())
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("rejects retained chooser confirmation and dismissal callbacks from an older request", async () => {
  const getItems = jest.fn(() => [{ "text/plain": "zero" }])
  const fixture = await setup({ getItems, onItemDrop: () => {} })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  const old = nativeVirtualDrag.pendingRequest()!
  await act(() => nativeVirtualDrag.cancel())
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  const current = nativeVirtualDrag.pendingRequest()!
  expect(current.id).not.toBe(old.id)
  await act(async () => {
    expect(nativeVirtualDrag.choose(binding, old.choices[0]!.target, old.id)).toBe(false)
    await nativeVirtualDrag.drop(old.id)
    nativeVirtualDrag.dismissed(old.id)
  })
  expect(nativeVirtualDrag.pendingRequest()).toBe(current)
  expect(current.phase).toBe("choosing")
  expect(getItems).not.toHaveBeenCalled()
  await act(() => nativeVirtualDrag.cancel())
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it("presents a declared root fallback as a logical request without admitting unrelated descendants", async () => {
  const fixture = await setup({ getItems: () => [{ "text/plain": "zero" }], onDrop: () => {} })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding
  await act(() => nativeVirtualDrag.start(binding, 0, nativeDragFormatter("en-US"), "virtual"))
  expect(nativeVirtualDrag.pendingRequest()!.choices.find((choice) => choice.target.type === "root")?.label).toBe(
    "Drop on Collection",
  )
  expect(fixture.metadata().virtualFocus).toBeUndefined()
  expect(binding.controller.activeSession()).toBeNull()
  await act(() => nativeVirtualDrag.cancel())
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it.each(["current", "window", "replacement"])(
  "waits for acknowledged offscreen targets and rejects %s retirement",
  async (mode) => {
    const onItemDrop = jest.fn(),
      requestRendering = jest.fn(),
      scrollToKey = jest.fn()
    const fixture = await setup(
      {
        onItemDrop,
        dropTargetDelegate: { getDropTargetFromPoint: () => ({ type: "item", key: "", dropPosition: "on" }) },
      },
      undefined,
      undefined,
      {
        requestRendering,
        scrollToKey,
        getItemRect: () => null,
        getVisibleRect: () => ({ x: 0, y: 0, width: 100, height: 200 }),
        getContentSize: () => ({ width: 100, height: 200 }),
      },
    )
    await fixture.row(0)
    await act(() => fixture.actions.dispatch(fixture.packet("target", { types: ["text/plain"], operations: ["copy"] })))
    expect(requestRendering).toHaveBeenCalledWith("")
    expect(scrollToKey).toHaveBeenCalledWith("")
    const binding = fixture.rendered.result.current.binding,
      release = jest.fn()
    const item = { kind: "text" as const, types: new Set(["text/plain"]), getText: async () => "original", release }
    let pending: Promise<void>
    await act(() => {
      pending = binding.virtualDrop("session", [item], { x: 110, y: 215 })
    })
    expect(onItemDrop).not.toHaveBeenCalled()
    const owner = {},
      oldMetadata = fixture.metadata()
    await act(() => binding.member("", owner, view(), "target"))
    expect(onItemDrop).not.toHaveBeenCalled()
    await act(() =>
      fixture.actions.acceptStatus(
        JSON.stringify({
          ...oldMetadata,
          kind: "binding",
          ownerId: "owner",
          windowId: "window",
          epoch: 1,
          ready: true,
          error: "",
        }),
      ),
    )
    expect(onItemDrop).not.toHaveBeenCalled()
    if (mode === "window")
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
    if (mode === "replacement") await act(() => binding.member("", owner, view(), "target"))
    await act(async () => {
      if (mode === "current") fixture.ready()
      await pending
    })
    expect(onItemDrop).toHaveBeenCalledTimes(mode === "current" ? 1 : 0)
    if (mode === "current") expect(onItemDrop.mock.calls[0][0].items[0]).toBe(item)
    else expect(release).toHaveBeenCalledTimes(1)
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  },
)

it("keeps pointer and accessible lift ineligible when a public prepared ref changes before metadata publication", async () => {
  const ref = { current: view() as View | null },
    getItems = jest.fn(() => [{ "text/plain": "zero" }])
  const fixture = await setup({ getItems, onItemDrop: () => {}, preparedDragPreview: { ref, x: 3, y: 7 } })
  await fixture.row(0)
  const binding = fixture.rendered.result.current.binding
  expect(binding.ready()).toBe(true)
  ref.current = null
  expect(binding.ready()).toBe(false)
  ref.current = view()
  expect(binding.ready()).toBe(false)
  await act(() => {
    expect(() => fixture.actions.dispatch(fixture.packet("lift"))).toThrow(/prepared original preview.*acknowledged/)
  })
  expect(getItems).not.toHaveBeenCalled()
  await act(() => binding.publish())
  expect(binding.ready()).toBe(false)
  await act(() => fixture.ready())
  expect(binding.ready()).toBe(true)
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})
