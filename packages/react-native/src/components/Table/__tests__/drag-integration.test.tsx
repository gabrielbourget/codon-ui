import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { useRef } from "react"
import { type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { useNativeDragAndDrop } from "../../../collection/dragAndDrop/hooks"
import { NativeDragDataBinding } from "../../../collection/dragAndDrop/nativeData"
import { createNativeKeyScope } from "../../../input/keyScope"
import { createNativeDragActions, NativeDragActionsContext } from "../../../input/nativeDragActions"
import type { TNativeDragMemberBinding } from "../../../input/nativeDragActions"
import { NativeThemeProvider } from "../../../theme"
import { DEFAULT_QUERY_CONTROL_LABELS } from "../../SortAndFilterPanel/controlLabels"
import { QuerySortParameterList } from "../../SortAndFilterPanel/SortParameterList"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    acceptsAction: jest.fn(() => true),
    settleAction: jest.fn(() => true),
  },
}))
afterEach(cleanup)
afterEach(() => jest.restoreAllMocks())
const originalRows = [
  { id: 0, name: "Zero" },
  { id: "", name: "Empty" },
]
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const scope = (keyboard = createNativeKeyScope("owner")) => {
  const actions = createNativeDragActions(keyboard)
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
  return actions
}
const Fixture = ({ items, trace }: { items: typeof originalRows; trace: unknown[] }) => {
  const { dragAndDropHooks } = useNativeDragAndDrop<(typeof originalRows)[number]>({
    getItems: (keys, values) => {
      trace.push(["items", [...keys], values])
      return values.map((row) => ({ "text/plain": row.name }))
    },
    onDragStart: () => trace.push("start"),
    onDragEnd: (event) => trace.push(["end", event.dropOperation]),
    onReorder: () => {},
  })
  const root = useRef<View | null>(null)
  return (
    <Table dragAndDropHooks={dragAndDropHooks} ref={root} accessibilityLabel="People">
      <TableHeader columns={columns} />
      <TableBody items={items} columns={columns} rowKey={(row) => row.id} />
    </Table>
  )
}
const installTags = () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const installed = native.findNodeHandle as jest.MockedFunction<typeof native.findNodeHandle>
  const original = jest.isMockFunction(installed) ? installed.getMockImplementation()! : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let tag = 70000
  const spy = jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const reserved = original(view)
    if (reserved != null && reserved >= 1000000) return reserved
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++tag)
    return tags.get(view)!
  })
  return () => spy.mockRestore()
}
it("connects the original Table rows, typed zero/empty keys, reserved drag column and source values", async () => {
  try {
    const restore = installTags(),
      keyboard = createNativeKeyScope("owner"),
      actions = scope(keyboard),
      trace: unknown[] = []
    let keyboardActive = true
    jest.spyOn(keyboard, "isWindowActive").mockImplementation(() => keyboardActive)
    const module = jest.requireActual<typeof import("../useTableKeyboard")>("../useTableKeyboard")
    const useKeyboard = module.useTableKeyboard
    const useControlledKeyboard: typeof useKeyboard = (owner) => {
      const current = useKeyboard(owner)
      return { ...current, canAct: () => keyboard.isWindowActive() !== false && current.canAct() }
    }
    jest.spyOn(module, "useTableKeyboard").mockImplementation(useControlledKeyboard)
    const tree = (items = originalRows) => (
      <NativeThemeProvider>
        <NativeDragActionsContext.Provider value={actions}>
          <Fixture items={items} trace={trace} />
        </NativeDragActionsContext.Provider>
      </NativeThemeProvider>
    )
    const rendered = await render(tree())
    const data = JSON.parse(actions.bindings())[0]
    expect(data.members.map((member: TNativeDragMemberBinding) => member.key)).toEqual(["number:0", "string:"])
    expect(JSON.parse(screen.getByTestId("table").props.nativeCollectionSemantics).columnCount).toBe(2)
    expect(screen.getByTestId("table").props.dragAndDropHooks).toBeUndefined()
    const member = data.members[0]
    actions.acceptStatus(
      JSON.stringify({
        kind: "binding",
        ownerId: "owner",
        windowId: "window",
        epoch: 1,
        moduleId: "native-module",
        bindingId: data.bindingId,
        revision: data.revision,
        rootTarget: data.rootTarget,
        ready: true,
        error: "",
      }),
    )
    const identity = {
      moduleId: "native-module",
      ownerId: "owner",
      bindingId: data.bindingId,
      revision: data.revision,
      rootTarget: data.rootTarget,
      itemTarget: member.targetTag,
      windowId: "window",
      epoch: 1,
      surfaceId: 1,
      scopeTarget: 10,
      sessionId: "table-drag",
      kind: "lift",
    }
    const geometry = {
      revision: 1,
      root: { x: 0, y: 0, width: 100, height: 100 },
      items: data.members.map((member: TNativeDragMemberBinding, index: number) => ({
        ...member,
        rect: { x: 0, y: index * 30, width: 100, height: 30 },
      })),
    }
    await act(() => {
      actions.dispatch(
        JSON.stringify({
          version: 1,
          token: 1,
          identity,
          payload: { x: 10, y: 10, key: member.key, instanceId: member.instanceId, geometry },
        }),
      )
    })
    expect(trace).toEqual(["start", ["items", [0], [originalRows[0]]]])
    keyboardActive = false
    actions.acceptStatus(
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
    await act(() => {
      expect(
        actions.dispatch(
          JSON.stringify({
            version: 1,
            token: 2,
            identity: { ...identity, kind: "move" },
            payload: { x: 10, y: 11, geometry: { ...geometry, revision: 2 } },
          }),
        ),
      ).toEqual({ moved: true })
      actions.dispatch(
        JSON.stringify({
          version: 1,
          token: 3,
          identity: { ...identity, kind: "end" },
          payload: { x: 10, y: 11, operation: "copy", geometry: { ...geometry, revision: 3 } },
        }),
      )
    })
    expect(trace.at(-1)).toEqual(["end", "copy"])

    await rendered.rerender(tree([...originalRows].reverse()))
    expect(
      JSON.parse(actions.bindings())[0].members.find((row: TNativeDragMemberBinding) => row.key === "number:0")
        .targetTag,
    ).toBe(member.targetTag)
    await rendered.unmount()
    actions.dispose()
    restore()
  } catch (error) {
    if (error instanceof AggregateError)
      throw new Error(error.errors.map((cause: Error) => cause.stack ?? String(cause)).join("\n"))
    throw error
  }
})
it("connects Sort to the canonical text payload and controller-owned reorder callback", async () => {
  const restore = installTags(),
    actions = scope(),
    onReorder = jest.fn()
  const rows = [
    { id: "", criteriaID: "city", criteriaName: "City", sortDirection: "Ascending" as const },
    { id: "name", criteriaID: "name", criteriaName: "Name", sortDirection: "Descending" as const },
  ]
  const rendered = await render(
    <NativeThemeProvider>
      <NativeDragActionsContext.Provider value={actions}>
        <QuerySortParameterList
          sortParameterList={rows}
          availableSortCriteria={[]}
          labels={DEFAULT_QUERY_CONTROL_LABELS.sortEntry}
          listLabels={DEFAULT_QUERY_CONTROL_LABELS.sortParameterList}
          onModifySortParameter={jest.fn()}
          onSortAscending={jest.fn()}
          onSortDescending={jest.fn()}
          onDeleteSortParameter={jest.fn()}
          onReorder={onReorder}
        />
      </NativeDragActionsContext.Provider>
    </NativeThemeProvider>,
  )
  const data = JSON.parse(actions.bindings())[0]
  expect(data.members.map((member: TNativeDragMemberBinding) => member.key)).toEqual(["string:", "string:name"])
  expect(data.draggable).toBe(true)
  expect(data.droppable).toBe(true)
  actions.acceptStatus(
    JSON.stringify({
      kind: "binding",
      ownerId: "owner",
      windowId: "window",
      epoch: 1,
      moduleId: "native-module",
      bindingId: data.bindingId,
      revision: data.revision,
      rootTarget: data.rootTarget,
      ready: true,
      error: "",
    }),
  )
  const geometry = {
    revision: 1,
    root: { x: 0, y: 0, width: 100, height: 100 },
    items: data.members.map((member: TNativeDragMemberBinding, index: number) => ({
      ...member,
      rect: { x: 0, y: index * 30, width: 100, height: 30 },
    })),
  }
  const member = data.members[0]
  const identity = {
    moduleId: "native-module",
    ownerId: "owner",
    bindingId: data.bindingId,
    revision: data.revision,
    rootTarget: data.rootTarget,
    itemTarget: member.targetTag,
    windowId: "window",
    epoch: 1,
    surfaceId: 1,
    scopeTarget: 10,
    sessionId: "sort-drag",
    kind: "lift",
  }
  let response: unknown
  await act(() => {
    response = actions.dispatch(
      JSON.stringify({
        version: 1,
        token: 1,
        identity,
        payload: { x: 10, y: 10, key: member.key, instanceId: member.instanceId, geometry },
      }),
    )
  })
  expect(response).toMatchObject({ items: [[{ type: "text/plain", data: "City" }]] })
  const read = jest
    .spyOn(NativeDragDataBinding.prototype, "takeItems")
    .mockResolvedValueOnce([
      { kind: "text", types: new Set(["text/plain"]), getText: async () => "City", release: () => {} },
    ])
  await act(async () => {
    actions.dispatch(
      JSON.stringify({
        version: 1,
        token: 2,
        identity: { ...identity, itemTarget: 0, kind: "drop" },
        payload: {
          x: 10,
          y: 59,
          geometry: { ...geometry, revision: 2 },
          types: ["text/plain"],
          operations: ["move"],
          dataHandle: "modeled-retained-text",
        },
      }),
    )
    await Promise.resolve()
  })
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
  read.mockRestore()
  expect(screen.getByTestId("query-sort-option-").props.onMoveShouldSetResponder).toBeUndefined()
  await rendered.unmount()
  actions.dispose()
  restore()
})
