import { cleanup } from "@testing-library/react-native"
import { createRef, useRef } from "react"
import { AccessibilityInfo, findNodeHandle, TextInput, type View } from "react-native"

import { useNativeDragAndDrop } from "../../../collection/dragAndDrop/hooks"
import { NativeDragDataBinding } from "../../../collection/dragAndDrop/nativeData"
import { createNativeKeyScope } from "../../../input/keyScope"
import { createNativeDragActions, NativeDragActionsContext } from "../../../input/nativeDragActions"
import type { TNativeDragMemberBinding } from "../../../input/nativeDragActions"
import { NativeThemeProvider } from "../../../theme"
import { DEFAULT_QUERY_CONTROL_LABELS } from "../../SortAndFilterPanel/controlLabels"
import { QuerySortParameterList } from "../../SortAndFilterPanel/SortParameterList"
import {
  nativeTableChildren,
  createNativeTableHeaderModel,
  createNativeTableBodyModel,
  nativeTableReceiver,
  createNativeTableRowModel,
} from "../model"
import { Table } from "../Table"

import { actWithNativeCollections as act, renderWithNativeCollections as render, screen } from "./collectionModel"
import { CellFixtureBody } from "./fixtures/TableCellFixture"

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
    onDragMove: (event) => trace.push(["move", [...event.keys], event.x, event.y]),
    onDragEnd: (event) => trace.push(["end", event.dropOperation]),
    onReorder: () => {},
  })
  const root = useRef<View | null>(null)
  return (
    <Table
      dragAndDropHooks={dragAndDropHooks}
      ref={root}
      accessibilityLabel="People"
      items={(modelOptions) =>
        nativeTableChildren(
          createNativeTableHeaderModel({ columns: columns }, modelOptions),
          createNativeTableBodyModel({ items: items, columns: columns, rowKey: (row) => row.id }, modelOptions),
        )
      }
    />
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
        metadataRevision: data.metadataRevision,
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
      ).toEqual({})
      expect(trace.at(-1)).toEqual(["move", [0], 10, 11])
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
      metadataRevision: data.metadataRevision,
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

it.each(["ordinary-release", "drag-release", "drag-cancel", "drag-space", "drag-enter"] as const)(
  "preserves controlled selection and original callbacks for %s",
  async (cycle) => {
    jest.useFakeTimers()
    const restore = installTags(),
      actions = scope()
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
    try {
      const order: string[] = [],
        events: unknown[] = [],
        requests: Array<"all" | Set<string | number>> = [],
        ref = createRef<View>(),
        editor = createRef<TextInput>()
      const keyboardCycle = cycle === "drag-space" || cycle === "drag-enter"
      const record = (name: string) => (event: unknown) => {
        order.push(name)
        events.push(event)
      }
      const ownedColumns = [
        { ...columns[0], cellRenderer: () => <TextInput ref={editor} testID="drag-selection-editor" value="held" /> },
      ]
      const Owner = () => {
        const { dragAndDropHooks } = useNativeDragAndDrop({
          getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
        })
        return (
          <NativeThemeProvider>
            <Table
              dragAndDropHooks={cycle === "ordinary-release" ? undefined : dragAndDropHooks}
              selectionMode="multiple"
              selectionBehavior="replace"
              selectedKeys={new Set(["a", "b"])}
              onSelectionChange={(keys) => {
                order.push("selection")
                requests.push(keys)
              }}
              items={(modelOptions) =>
                nativeTableChildren(
                  createNativeTableHeaderModel({ columns: columns }, modelOptions),
                  nativeTableReceiver<React.ComponentProps<typeof CellFixtureBody>>(
                    "__body:1",
                    "tablebody",
                    {},
                    (visibleProps) => <CellFixtureBody {...visibleProps} />,
                    nativeTableChildren(
                      createNativeTableRowModel(
                        {
                          ref: ref,
                          testID: "drag-selection-row",
                          id: "a",
                          item: { id: "a", name: "Alpha" },
                          columns: ownedColumns,
                          onPressStart: record("start"),
                          onPressUp: record("up"),
                          onPressEnd: record("end"),
                          onPress: record("press"),
                          onPressChange: (value) => order.push(`change:${value}`),
                          onAction: keyboardCycle ? () => order.push("action") : undefined,
                        },
                        modelOptions,
                      ),
                      createNativeTableRowModel(
                        { testID: "drag-selection-other", id: "b", item: { id: "b", name: "Beta" }, columns: columns },
                        modelOptions,
                      ),
                    ),
                  ),
                )
              }
            />
          </NativeThemeProvider>
        )
      }
      await render(
        <NativeDragActionsContext.Provider value={actions}>
          <Owner />
        </NativeDragActionsContext.Provider>,
      )
      const original = ref.current,
        originalEditor = editor.current,
        host = () => screen.getByTestId("drag-selection-row").props,
        tag = findNodeHandle(original),
        event = (timestamp: number) => ({
          persist: jest.fn(),
          target: tag,
          currentTarget: tag,
          nativeEvent: { target: tag, timestamp, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
        }),
        keyEvent = (phase: "down" | "up", timestamp: number) => ({
          persist: jest.fn(),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
          isDefaultPrevented: () => false,
          nativeEvent: {
            kind: "keyboard",
            ownerId: host().ownerId,
            target: tag,
            key: cycle === "drag-space" ? " " : "Enter",
            nativeCode: cycle === "drag-space" ? 44 : 40,
            phase,
            repeat: false,
            cancelled: false,
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            nativeDefaultHandled: true,
            timestamp,
          },
        }),
        down = keyboardCycle ? keyEvent("down", 0) : event(0),
        end = keyboardCycle ? keyEvent("up", 200) : event(200),
        write = jest.spyOn(originalEditor!, "setNativeProps")
      if (keyboardCycle) await act(() => host().onNativeKey(down))
      else {
        await act(() =>
          host().onPointerDown({
            nativeEvent: {
              pointerType: "mouse",
              target: tag,
              shiftKey: false,
              ctrlKey: false,
              metaKey: false,
              altKey: false,
            },
          }),
        )
        await act(() => host().onResponderGrant(down))
      }
      expect(events).toHaveLength(1)
      expect(events[0]).toBe(down)
      expect(order).toEqual(
        cycle === "ordinary-release" || cycle === "drag-space"
          ? ["selection", "start", "change:true"]
          : ["start", "change:true"],
      )
      expect(requests).toHaveLength(cycle === "ordinary-release" || cycle === "drag-space" ? 1 : 0)
      await act(() => jest.advanceTimersByTime(200))
      if (keyboardCycle) await act(() => host().onNativeKey(end))
      else if (cycle === "drag-cancel") await act(() => host().onResponderTerminate(end))
      else await act(() => host().onResponderRelease(end))
      await act(() => jest.runOnlyPendingTimers())
      expect(order).toEqual(
        cycle === "drag-cancel"
          ? ["start", "change:true", "end", "change:false"]
          : cycle === "ordinary-release" || cycle === "drag-space"
            ? ["selection", "start", "change:true", "up", "end", "change:false", "press"]
            : cycle === "drag-enter"
              ? ["start", "change:true", "up", "end", "change:false", "action", "press"]
              : ["start", "change:true", "up", "end", "change:false", "selection", "press"],
      )
      expect(events).toHaveLength(cycle === "drag-cancel" ? 2 : 4)
      events.forEach((event, index) => expect(event).toBe(index === 0 ? down : end))
      expect(requests.map((keys) => (keys === "all" ? keys : { keys: [...keys], size: keys.size }))).toEqual(
        cycle === "drag-cancel" || cycle === "drag-enter" ? [] : [{ keys: ["a"], size: 1 }],
      )
      expect(host().accessibilityState.selected).toBe(true)
      expect(screen.getByTestId("drag-selection-other").props.accessibilityState.selected).toBe(true)
      expect(ref.current).toBe(original)
      expect(editor.current).toBe(originalEditor)
      expect(screen.getByTestId("drag-selection-editor").props.value).toBe("held")
      expect(write).not.toHaveBeenCalled()
    } finally {
      await cleanup()
      actions.dispose()
      jest.clearAllTimers()
      jest.useRealTimers()
      restore()
    }
  },
)
