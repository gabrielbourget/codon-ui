import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { NativeKeyboardScope } from "../../../input/NativeKeyboardScope"
import { nativeCollectionFocusBinding } from "../../../input/nativeVisibleCollectionAdmission"
import { NativeThemeProvider } from "../../../theme"
import { DEFAULT_QUERY_CONTROL_LABELS } from "../../SortAndFilterPanel/controlLabels"
import { QuerySortParameterList } from "../../SortAndFilterPanel/SortParameterList"
import { SortParameterList } from "../../SortParameterList/SortParameterList"
import {
  createNativeTableHeaderModel,
  createNativeTableBodyModel,
  createNativeTableRowModel,
  nativeTableChildren,
} from "../model"
import { Table } from "../Table"

// Only native transport is substituted. The real production publisher/adapter performs
// registration, acknowledgement, binding publication and one-shot action checks.
jest.mock("../../../input/specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestTextInputFocus: jest.fn() },
}))
jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: { getLease: () => "source-drag-module", acceptsAction: () => false, settleAction: () => false },
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
let tags: WeakMap<object, number>, nextTag: number
beforeEach(() => {
  jest.useFakeTimers()
  tags = new WeakMap()
  nextTag = 1000
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((original) => {
    if (!original || typeof original !== "object") return typeof original === "number" ? original : null
    if (!tags.has(original)) tags.set(original, ++nextTag)
    return tags.get(original)!
  })
})
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
type TPublishedRegistration = { id: string; tag: number; itemId?: string; itemRevision?: string }
type TPublication = {
  intent: string
  model: { revision: string }
  root: TPublishedRegistration
  receivers: TPublishedRegistration[]
}
const publisher = () => screen.container.queryAll((host) => typeof host.props.publication === "string")[0]
const publication = (): TPublication => JSON.parse(publisher().props.publication)
const requests = (): { id: string; binding: string }[] => JSON.parse(publisher().props.actionRequests)
const acknowledged = (registration: TPublishedRegistration, revision: number) =>
  `source-native:${revision}:${registration.id}`
const acknowledge = async (sequence = 1, registrations?: TPublishedRegistration[]) => {
  const current = publication()
  await act(() =>
    publisher().props.onNativeCollectionCommit({
      nativeEvent: {
        data: JSON.stringify({
          intent: current.intent,
          publisher: "source-native-publisher",
          instance: 1,
          sequence,
          lifetime: `source-native-root:${sequence}`,
          registrations: (registrations ?? [current.root, ...current.receivers]).map((entry) => ({
            id: entry.id,
            tag: entry.tag,
            binding: acknowledged(entry, sequence),
          })),
        }),
      },
    }),
  )
}
const respond = async (pending: { id: string; binding: string }, accepted: boolean) =>
  act(() =>
    publisher().props.onNativeCollectionAction({
      nativeEvent: {
        data: JSON.stringify({
          ...pending,
          accepted,
          publisher: "source-native-publisher",
        }),
      },
    }),
  )
const bindings = () =>
  screen.container
    .queryAll((host) => !!host.props.nativeCollectionBinding)
    .map((host) => host.props.nativeCollectionBinding as string)
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const items = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
]

it("registers Table original root/rows/cells/column once, refreshes cached bindings and refuses missing or rejected acknowledgement", async () => {
  const original = createRef<RN.View>(),
    row = createRef<RN.View>(),
    action = jest.fn()
  const tree = (rows = items, replacement = false) => (
    <NativeThemeProvider>
      <Table
        ref={original}
        clickableRows
        onRowAction={action}
        render={({ ref, children, style, testID, onLayout }) => (
          <RN.View
            ref={ref}
            style={style}
            testID={testID}
            onLayout={onLayout}
            key={replacement ? "replacement" : "original"}
          >
            {children}
          </RN.View>
        )}
        columns={columns}
        items={(options) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns }, options),
            createNativeTableBodyModel(
              { columns },
              options,
              rows.map((item) =>
                createNativeTableRowModel(
                  {
                    id: item.id,
                    item,
                    columns,
                    ref: item.id === "a" ? row : undefined,
                  },
                  options,
                ),
              ),
            ),
          )
        }
      />
    </NativeThemeProvider>
  )
  const view = await render(tree())
  const initial = publication()
  expect(initial.root.tag).toBe(tags.get(original.current!))
  expect(initial.receivers).toHaveLength(5)
  expect(new Set(initial.receivers.map((entry) => entry.tag)).size).toBe(5)
  const registeredRow = initial.receivers.find((entry) => entry.tag === tags.get(row.current!))!
  expect(registeredRow).toBeDefined()
  const rowHost = () => screen.getByTestId("table-row-string:a")
  expect(rowHost().props.nativeCollectionBinding).toBe("")
  await userEvent.setup().press(rowHost())
  expect(requests()).toEqual([])
  expect(action).not.toHaveBeenCalled()
  await acknowledge()
  expect(rowHost().props.nativeCollectionBinding).toBe(acknowledged(registeredRow, 1))
  for (const entry of initial.receivers) expect(bindings()).toContain(acknowledged(entry, 1))
  await userEvent.setup().press(rowHost())
  const rejected = requests()
  expect(rejected.length).toBeGreaterThan(0)
  for (const pending of rejected) await respond(pending, false)
  expect(action).not.toHaveBeenCalled()
  expect(requests()).toEqual([])
  await userEvent.setup().press(rowHost())
  const accepted = requests()
  expect(accepted.length).toBeGreaterThan(0)
  for (const pending of accepted) await respond(pending, true)
  expect(action).toHaveBeenCalledWith("a")
  await respond(accepted[0], true)
  expect(action).toHaveBeenCalledTimes(1)
  const held = row.current
  await view.rerender(tree([...items].reverse()))
  expect(row.current).toBe(held)
  expect(publication().receivers).toHaveLength(5)
  expect(rowHost().props.nativeCollectionBinding).toBe("")
  await acknowledge(2)
  await userEvent.setup().press(rowHost())
  const stale = requests()[0]
  expect(stale).toBeDefined()
  await view.rerender(tree(items, true))
  expect(row.current).not.toBe(held)
  expect(nativeCollectionFocusBinding(held!)).toBeNull()
  expect(publication().root.tag).not.toBe(initial.root.tag)
  await respond(stale, true)
  expect(action).toHaveBeenCalledTimes(1)
  expect(rowHost().props.nativeCollectionBinding).toBe("")
  await acknowledge(3)
  expect(requests()).toEqual([])
  const finalRow = row.current!
  await view.unmount()
  expect(nativeCollectionFocusBinding(finalRow)).toBeNull()
  expect(original.current).toBeNull()
  expect(row.current).toBeNull()
})

it.each(["standalone", "query"] as const)(
  "registers only the primary %s Sort rows and refreshes bindings without replacing their original hosts",
  async (kind) => {
    const tree = (rows = items) => (
      <NativeThemeProvider>
        <NativeKeyboardScope captureEnabled>
          {kind === "standalone" ? (
            <SortParameterList
              sortParameterList={rows.map((item) => ({ ID: item.id, name: item.name, sortDirection: "Ascending" }))}
              onSortParameterListChange={jest.fn()}
            />
          ) : (
            <QuerySortParameterList
              sortParameterList={rows.map((item) => ({
                id: item.id,
                criteriaID: item.id,
                criteriaName: item.name,
                sortDirection: "Ascending",
              }))}
              availableSortCriteria={[]}
              labels={DEFAULT_QUERY_CONTROL_LABELS.sortEntry}
              listLabels={DEFAULT_QUERY_CONTROL_LABELS.sortParameterList}
              onModifySortParameter={jest.fn()}
              onSortAscending={jest.fn()}
              onSortDescending={jest.fn()}
              onDeleteSortParameter={jest.fn()}
            />
          )}
        </NativeKeyboardScope>
      </NativeThemeProvider>
    )
    const view = await render(tree())
    const initial = publication()
    expect(initial.root.tag).toBeGreaterThan(0)
    expect(initial.receivers).toHaveLength(2)
    expect(new Set(initial.receivers.map((entry) => entry.tag)).size).toBe(2)
    await acknowledge()
    for (const entry of initial.receivers) expect(bindings()).toContain(acknowledged(entry, 1))
    await view.rerender(tree([...items].reverse()))
    const reordered = publication()
    expect(reordered.root.tag).toBe(initial.root.tag)
    expect(reordered.receivers.map((entry) => entry.tag).sort()).toEqual(
      initial.receivers.map((entry) => entry.tag).sort(),
    )
    expect(bindings()).not.toContain(acknowledged(initial.receivers[0], 1))
    await acknowledge(2)
    for (const entry of reordered.receivers) expect(bindings()).toContain(acknowledged(entry, 2))
    await view.rerender(tree([items[1]]))
    expect(publication().receivers).toHaveLength(1)
    await acknowledge(3)
    expect(bindings()).not.toContain(acknowledged(initial.receivers[0], 1))
  },
)
