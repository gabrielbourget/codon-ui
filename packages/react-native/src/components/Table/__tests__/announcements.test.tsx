import "../../../collection/__tests__/nativeReceipts"

import { act as nativeAct, cleanup } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import { AccessibilityInfo, findNodeHandle, Platform, TextInput, View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusView, type NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeKeyboardScope, useNativeWindowPointers } from "../../../input/NativeKeyboardScope"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { NativeTablePropsContext, NativeTableStateContext } from "../context"
import type { TNativeTableState } from "../state/useTableState"
import { Table } from "../Table"
import { TableColumn } from "../TableColumn"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"

import { CellFixtureBody } from "./fixtures/TableCellFixture"
import { ColumnFixtureHeader } from "./fixtures/TableColumnFixture"

let state: TNativeTableState<object>
const Probe = () => {
  state = useContext(NativeTableStateContext)!
  return null
}
type TOptions = {
  selected?: Set<string | number> | "all"
  behavior?: "toggle" | "replace"
  mode?: "none" | "single" | "multiple"
  rowAction?: () => void
  rootAction?: (key: string | number) => void
  clickableRows?: boolean
  sort?: { column: string; direction: "ascending" | "descending" }
  columnName?: string
  locale?: string
  active?: () => boolean
  changed?: (keys: unknown) => void
  root?: React.RefObject<View | null>
  editor?: React.RefObject<TextInput | null>
}
const empty = new Set<string | number>()
const tree = ({
  selected = empty,
  behavior = "toggle",
  mode = "multiple",
  rowAction,
  rootAction,
  clickableRows,
  sort,
  columnName = "Name",
  locale = "en-US",
  active,
  changed,
  root,
  editor,
}: TOptions = {}) => {
  const columns = [
    {
      id: "name",
      name: columnName,
      isRowHeader: true,
      cellRenderer: () => <TextInput ref={editor} testID="announcement-editor" value="held" />,
    },
  ]
  return (
    <NativeFloatingWindowContext.Provider value={active ?? null}>
      <NativeLocaleProvider locale={locale}>
        <NativeThemeProvider>
          <NativeTablePropsContext.Provider value={{ sortDescriptor: sort, onSortChange: () => {} }}>
            <Table
              ref={root}
              testID="announcement-table"
              accessibilityLabel="Records"
              accessibilityHint="Author hint"
              ariaDescribedBy={["author-first", "author-second"]}
              ariaDetails="author-details"
              selectionMode={mode}
              selectionBehavior={behavior}
              onRowAction={rootAction}
              clickableRows={clickableRows}
              selectedKeys={selected}
              onSelectionChange={changed}
            >
              <TableHeader
                columns={columns}
                render={(host) => (
                  <View {...host}>
                    <Probe />
                    {host.children}
                  </View>
                )}
              />
              <CellFixtureBody>
                <TableRow onAction={rowAction} id={0} textValue="Alpha" item={{}} columns={columns} />
                <TableRow id="" textValue="Beta" item={{}} columns={columns} />
              </CellFixtureBody>
            </Table>
          </NativeTablePropsContext.Provider>
        </NativeThemeProvider>
      </NativeLocaleProvider>
    </NativeFloatingWindowContext.Provider>
  )
}
const focus = async (root: React.RefObject<View | null>, focused: boolean) => {
  const host = screen.getByTestId("announcement-table")
  await act(() =>
    host.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: host.props.ownerId,
        target: findNodeHandle(root.current),
        isFocused: focused,
        isFocusVisible: true,
      },
    }),
  )
}
const installOriginalRowTags = () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const installed = native.findNodeHandle as jest.MockedFunction<typeof native.findNodeHandle>
  const original = jest.isMockFunction(installed) ? installed.getMockImplementation()! : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let next = 80000
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const reserved = original(view)
    if (reserved != null && reserved >= 1000000) return reserved
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
}

const announcements = () => jest.mocked(AccessibilityInfo.announceForAccessibilityWithOptions).mock.calls
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  installOriginalRowTags()
  jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions").mockImplementation(() => {})
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("preserves Table initial sort description before authored relationships without an initial live announcement", async () => {
  const root = createRef<View>()
  await render(tree({ root, sort: { column: "name", direction: "ascending" } }))
  const host = screen.getByTestId("announcement-table")
  const ids = host.props.nativeDescribedBy
  expect(ids).toHaveLength(3)
  expect(ids.slice(1)).toEqual(["author-first", "author-second"])
  expect(screen.getByTestId("table-sort-description", { includeHiddenElements: true }).props.nativeID).toBe(ids[0])
  expect(screen.getByText("sorted by column Name in ascending order", { includeHiddenElements: true })).toBeTruthy()
  expect(host.props).toMatchObject({
    accessibilityLabel: "Records",
    accessibilityHint: "Author hint",
    nativeDetailsBy: ["author-details"],
  })
  expect(announcements()).toEqual([])
  await focus(root, true)
  expect(state.selectionManager.isFocused).toBe(true)
  expect(announcements()).toEqual([])
})

it("announces only committed focused Table selection with localized one/add/remove/count/all messages", async () => {
  const root = createRef<View>(),
    changed = jest.fn()
  const content = (selected: Set<string | number> | "all", locale = "en-US") =>
    tree({ root, selected, locale, changed })
  const view = await render(content(empty))
  await focus(root, true)
  await act(() => state.selectionManager.replaceSelection(0))
  expect(changed).toHaveBeenCalledTimes(1)
  expect(announcements()).toEqual([])
  await view.rerender(content(new Set([0])))
  expect(announcements()).toEqual([["Alpha selected.", { queue: true }]])
  await view.rerender(content(new Set([0, ""])))
  await view.rerender(content(new Set([""])))
  await view.rerender(content("all"))
  await view.rerender(content(empty))
  expect(announcements().map(([text]) => text)).toEqual([
    "Alpha selected.",
    "Beta selected. 2 items selected.",
    "Alpha not selected. 1 item selected.",
    "All items selected.",
    "No items selected.",
  ])
  await view.rerender(content(new Set([0]), "fr-FR"))
  expect(announcements().at(-1)).toEqual(["Alpha sélectionné.", { queue: true }])
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled()
})

it("updates Table sort description/name/localization and clears it without replacing caller prose or original refs", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>()
  const content = (sort: TOptions["sort"], columnName = "Name", locale = "en-US") =>
    tree({ root, editor, sort, columnName, locale })
  const view = await render(content({ column: "name", direction: "ascending" }))
  const originalRoot = root.current,
    originalEditor = editor.current!,
    write = jest.spyOn(originalEditor, "setNativeProps")
  await view.rerender(content({ column: "name", direction: "descending" }))
  expect(announcements()).toEqual([["sorted by column Name in descending order", { queue: false }]])
  await view.rerender(content({ column: "name", direction: "descending" }, "Surname"))
  expect(announcements().at(-1)).toEqual(["sorted by column Surname in descending order", { queue: false }])
  await view.rerender(content({ column: "name", direction: "ascending" }, "Nom", "fr-FR"))
  expect(announcements().at(-1)).toEqual(["trié en fonction de la colonne Nom par ordre croissant", { queue: false }])
  const count = announcements().length
  await view.rerender(content(undefined, "Nom", "fr-FR"))
  expect(screen.queryByTestId("table-sort-description", { includeHiddenElements: true })).toBeNull()
  expect(screen.getByTestId("announcement-table").props.nativeDescribedBy).toEqual(["author-first", "author-second"])
  expect(announcements()).toHaveLength(count)
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(write).not.toHaveBeenCalled()
})

it("suppresses unfocused/covered/stale Table announcement work and cancels pending work on unmount", async () => {
  const root = createRef<View>()
  let active = true
  const content = (selected: Set<string | number>, sort?: TOptions["sort"]) =>
    tree({ root, selected, sort, active: () => active })
  const view = await render(content(empty))
  await view.rerender(content(new Set([0])))
  await act(() => jest.advanceTimersByTime(32))
  expect(announcements()).toEqual([])
  await focus(root, true)
  expect(announcements()).toEqual([])
  active = false
  await view.rerender(content(new Set([0, ""]), { column: "name", direction: "descending" }))
  await act(() => jest.advanceTimersByTime(32))
  expect(announcements()).toEqual([])
  active = true
  await view.rerender(content(new Set([0, ""]), { column: "name", direction: "descending" }))
  expect(announcements()).toEqual([])
  await focus(root, false)
  // Root blur alone may move into a descendant; this control requires actual collection focus loss.
  await act(() => state.selectionManager.setFocused(false))
  expect(state.selectionManager.isFocused).toBe(false)
  await view.rerender(content(empty, { column: "name", direction: "descending" }))
  await view.unmount()
  await nativeAct(() => jest.runOnlyPendingTimers())
  expect(announcements()).toEqual([])
})

it("uses the Android Table announcement API for committed selection and assertive sort updates", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const root = createRef<View>()
  const view = await render(tree({ root }))
  await focus(root, true)
  await view.rerender(tree({ root, selected: new Set([0]) }))
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith("Alpha selected.")
  await view.rerender(tree({ root, selected: new Set([0]), sort: { column: "name", direction: "ascending" } }))
  expect(jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.map(([text]) => text)).toEqual([
    "Alpha selected.",
    "sorted by column Name in ascending order",
  ])
  expect(announcements()).toEqual([])
})

it.each(["ios", "android"] as const)(
  "preserves Table sortable column descriptions/localized values on the original %s host",
  async (platform) => {
    jest.replaceProperty(Platform, "OS", platform)
    const original = createRef<View>(),
      editor = createRef<TextInput>(),
      sorted = jest.fn()
    const columns = [
      {
        id: "name",
        name: "Name",
        isRowHeader: true,
        cellRenderer: () => <TextInput ref={editor} value="held" testID="column-description-editor" />,
      },
    ]
    const content = (enabled: boolean, direction?: "ascending" | "descending", locale = "en-US", custom = false) => (
      <NativeLocaleProvider locale={locale}>
        <NativeThemeProvider>
          <NativeTablePropsContext.Provider
            value={{ sortDescriptor: direction ? { column: "name", direction } : undefined, onSortChange: sorted }}
          >
            <Table>
              <ColumnFixtureHeader>
                <TableColumn
                  ref={original}
                  id="name"
                  columnID="name"
                  textValue="Name"
                  isRowHeader
                  allowsSorting={enabled}
                  testID="described-column"
                  accessibilityLabel=""
                  accessibilityHint="Author column hint"
                  accessibilityValue={{ text: "Author value" }}
                  render={
                    custom
                      ? (host) => {
                          const concrete: React.ComponentProps<typeof NativeFocusHost> = host
                          return (
                            <NativeFocusView
                              {...{
                                ...host,
                                nativeDescribedBy: [...(concrete.nativeDescribedBy ?? []), "column-author"],
                              }}
                            />
                          )
                        }
                      : undefined
                  }
                >
                  Name
                </TableColumn>
              </ColumnFixtureHeader>
              <CellFixtureBody>
                <TableRow id={0} item={{}} columns={columns} />
              </CellFixtureBody>
            </Table>
          </NativeTablePropsContext.Provider>
        </NativeThemeProvider>
      </NativeLocaleProvider>
    )
    const view = await render(content(false)),
      held = original.current,
      heldEditor = editor.current
    const host = () => screen.getByTestId("described-column")
    expect(host().props.accessibilityValue).toEqual({ text: "Author value" })
    await view.rerender(content(true))
    const id = host().props.nativeDescribedBy[0]
    expect(screen.getByText("sortable column", { includeHiddenElements: true })).toBeTruthy()
    expect(host().props.accessibilityValue).toEqual({ text: "none" })
    await view.rerender(content(true, "ascending", "en-US", true))
    expect(host().props.nativeDescribedBy).toEqual([id, "column-author"])
    expect(
      screen.getByText(platform === "android" ? "sortable column, ascending" : "sortable column", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy()
    expect(host().props.accessibilityValue).toEqual({ text: "ascending" })
    await view.rerender(content(true, "descending", "fr-FR", true))
    expect(
      screen.getByText(platform === "android" ? "colonne triable, décroissant" : "colonne triable", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy()
    expect(host().props.accessibilityValue).toEqual({ text: "décroissant" })
    await view.rerender(content(true, undefined, "fr-FR", true))
    expect(host().props.accessibilityValue).toEqual({ text: "none" })
    await view.rerender(content(false, undefined, "fr-FR", true))
    expect(host().props.nativeDescribedBy).toEqual(["column-author"])
    expect(host().props).toMatchObject({
      accessibilityLabel: "",
      accessibilityHint: "Author column hint",
      accessibilityValue: { text: "Author value" },
    })
    expect(original.current).toBe(held)
    expect(editor.current).toBe(heldEditor)
    expect(sorted).not.toHaveBeenCalled()
  },
)

it("preserves Table long-press selection hint predicates and sort-first authored description ordering", async () => {
  const action = () => {},
    sort = { column: "name", direction: "ascending" as const }
  const content = (extra: Partial<TOptions>) =>
    tree({ sort, behavior: "replace", rootAction: action, clickableRows: true, ...extra })
  const view = await render(content({}))
  const ids = screen.getByTestId("announcement-table").props.nativeDescribedBy
  expect(ids).toHaveLength(4)
  expect(ids.slice(2)).toEqual(["author-first", "author-second"])
  expect(screen.getByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeTruthy()
  for (const extra of [
    { mode: "none" as const },
    { behavior: "toggle" as const },
    { clickableRows: false },
    { rootAction: undefined, rowAction: action },
  ]) {
    await view.rerender(content(extra))
    expect(screen.queryByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId("announcement-table").props.nativeDescribedBy).toEqual([
      ids[0],
      "author-first",
      "author-second",
    ])
  }
  await view.rerender(content({ locale: "fr-FR" }))
  expect(
    screen.getByText("Appuyez de manière prolongée pour passer en mode de sélection.", { includeHiddenElements: true }),
  ).toBeTruthy()
})

it("updates Table long-press hint from actual scoped keyboard/pointer observations without synthetic virtual packets", async () => {
  const root = createRef<View>()
  let pointers: NonNullable<ReturnType<typeof useNativeWindowPointers>>
  const PointerProbe = () => {
    pointers = useNativeWindowPointers()!
    return null
  }
  const content = (
    <NativeKeyboardScope captureEnabled testID="hint-scope">
      <PointerProbe />
      {tree({
        root,
        sort: { column: "name", direction: "ascending" },
        behavior: "replace",
        rootAction: () => {},
        clickableRows: true,
      })}
    </NativeKeyboardScope>
  )
  await render(content)
  const scope = () => screen.getByTestId("hint-scope").props
  expect(screen.getByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeTruthy()
  await act(() =>
    scope().onNativeScopeStatus({
      nativeEvent: {
        ownerId: scope().ownerId,
        windowId: "hint-window",
        epoch: 1,
        policyRevision: scope().policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  const observe = (origin: "keyboard" | "pointer", timestamp: number) =>
    act(() =>
      scope().onNativeInputModality({
        nativeEvent: { ownerId: scope().ownerId, windowId: "hint-window", epoch: 1, origin, timestamp },
      }),
    )
  await observe("keyboard", 1)
  expect(screen.queryByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeNull()
  expect(screen.getByTestId("announcement-table").props.nativeDescribedBy).toHaveLength(3)
  const claimed = jest.fn()
  const previous = new Set(pointers!.registrations().map(({ id }) => id))
  const release = pointers!.register("hint-original-root", {
    targetTag: findNodeHandle(root.current)!,
    global: true,
    stopPropagation: true,
    current: () => true,
    start: () => true,
    move: jest.fn(),
    end: jest.fn(),
    activate: claimed,
    retire: jest.fn(),
  })
  const registrations = pointers!.registrations().filter(({ id }) => !previous.has(id))
  expect(registrations).toHaveLength(1)
  await act(() =>
    scope().onNativePointerStatus({
      nativeEvent: {
        ownerId: scope().ownerId,
        windowId: "hint-window",
        epoch: 1,
        revision: pointers!.revision(),
        ready: true,
        error: "",
      },
    }),
  )
  const activate = (windowId: string, sequence: number) =>
    act(() =>
      scope().onNativeWindowPointer({
        nativeEvent: {
          ownerId: scope().ownerId,
          windowId,
          epoch: 1,
          sequence,
          phase: "activation",
          pointerId: -1,
          pointerType: "virtual",
          isPrimary: true,
          button: 0,
          buttons: 0,
          nativeButtons: "0",
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          nativeModifiers: "0",
          pageX: 0,
          pageY: 0,
          timestamp: sequence,
          target: findNodeHandle(root.current),
          registrations: registrations.map((entry) => ({
            ...entry,
            ownerId: scope().ownerId,
            epoch: 1,
            revision: pointers!.revision(),
            depth: -1,
          })),
        },
      }),
    )
  await activate("wrong-window", 1)
  expect(claimed).not.toHaveBeenCalled()
  expect(screen.queryByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeNull()
  await activate("hint-window", 2)
  expect(claimed).toHaveBeenCalledTimes(1)
  expect(screen.getByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeTruthy()
  await observe("keyboard", 3)
  expect(screen.queryByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeNull()
  await observe("pointer", 4)
  expect(screen.getByText("Long press to enter selection mode.", { includeHiddenElements: true })).toBeTruthy()
  expect(screen.getByTestId("announcement-table").props.nativeDescribedBy).toHaveLength(4)
  await act(() => release())
})
