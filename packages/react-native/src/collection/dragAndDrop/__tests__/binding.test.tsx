import { act, renderHook } from "@testing-library/react-native"
import { useRef } from "react"
import * as Native from "react-native"
import { findNodeHandle, type View } from "react-native"

import { createNativeKeyScope } from "../../../input/keyScope"
import { NativeDragActionsContext, createNativeDragActions } from "../../../input/nativeDragActions"
import type { TNativeDragActionIdentity, TNativeDragMemberBinding } from "../../../input/nativeDragActions"
import { SelectionManager } from "../../state/SelectionManager"
import { useMultipleSelectionState } from "../../state/useMultipleSelectionState"
import { nativeDragRootFor, useNativeCollectionDragAndDrop, useNativeDragAndDrop } from "../hooks"
import type { TNativeDragAndDropOptions } from "../hooks"
import { nativeVirtualDrag } from "../virtualDrag"

import { dragCollection, dragValues } from "./fixtures"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    acceptsAction: jest.fn(() => true),
    settleAction: jest.fn(() => true),
  },
}))
// Synthetic original-view identities and native packets prove source routing only.
let tag = 100
const view = () => ({ dragTestTag: ++tag }) as unknown as View
beforeEach(() => {
  jest
    .spyOn(Native, "findNodeHandle")
    .mockImplementation((view: unknown) => (view as { dragTestTag: number } | null)?.dragTestTag ?? null)
})
afterEach(() => {
  nativeVirtualDrag.cancel()
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
      return { ...result, original: root, binding: nativeDragRootFor(root, actions)! }
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
            rect: { x: 100, y: member.key === "number:0" ? 200 : 230, width: 100, height: 30 },
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
