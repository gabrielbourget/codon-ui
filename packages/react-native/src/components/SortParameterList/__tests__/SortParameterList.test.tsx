import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, within } from "@testing-library/react-native"
import type * as RN from "react-native"

import { SortParameterList, type SortParameter } from ".."
import {
  actWithNativeCollections as collectionAct,
  renderWithNativeCollections as collectionRender,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { nativeVirtualDrag } from "../../../collection/dragAndDrop/virtualDrag"
import { NativeDragActionsContext } from "../../../input/nativeDragActions"
import { NativeThemeProvider } from "../../../theme"
import { createSortDragFixture } from "../../SortAndFilterPanel/__tests__/fixtures/SortDragFixture"
import { reorderNativeSortParameters } from "../reorder"

const { reorderSortParameterList: canonicalReorder } = jest.requireActual<{
  reorderSortParameterList: typeof reorderNativeSortParameters
}>("../../../../../react/src/components/SortParameterList/helpers")

let mockFixture: ReturnType<typeof createSortDragFixture>
const mockViews = new Map<string, RN.View>()
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react"),
    Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const latest = React.useRef(props)
      latest.current = props
      const bind = React.useCallback(
        (view: RN.View | null) => {
          if (view) {
            mockViews.set(props.ownerId, view)
            mockFixture.bind(view, () => latest.current)
          } else mockViews.delete(props.ownerId)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref, props.ownerId],
      )
      return <Native.View {...props} ref={bind} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "sort-native-module"),
    acceptsAction: jest.fn(),
    settleAction: jest.fn(),
    readGeometry: jest.fn(),
    readItems: jest.fn(),
    adoptItems: jest.fn(),
    releaseData: jest.fn(),
    readText: jest.fn(),
  },
}))
const parameters: SortParameter[] = [
  { ID: "name", name: "Name", sortDirection: "Ascending" },
  { ID: "date", name: "Date", sortDirection: "Descending" },
]
const tree = (props: Partial<React.ComponentProps<typeof SortParameterList>> = {}) => (
  <NativeThemeProvider>
    <NativeDragActionsContext.Provider value={mockFixture.actions}>
      <SortParameterList sortParameterList={parameters} {...props} />
    </NativeDragActionsContext.Provider>
  </NativeThemeProvider>
)
const act = async <T,>(callback: () => T | Promise<T>) => {
  mockFixture.ready()
  const result = await collectionAct(callback)
  mockFixture.ready()
  return result
}
const render: typeof collectionRender = async (element, options) => {
  const view = await collectionRender(element, options)
  mockFixture.ready()
  const rerender = view.rerender
  view.rerender = async (element) => {
    await rerender(element)
    mockFixture.ready()
  }
  return view
}
const rows = () => screen.getAllByTestId("sort-parameter-list-item", { includeHiddenElements: true })
const row = (id: string) => rows().find((item) => item.props.nativeID === id)!
const select = (id: string) => {
  const view = mockViews.get(row(id).props.ownerId)!
  mockFixture.setRect(view, () => ({
    x: 0,
    y: rows().findIndex((item) => item.props.nativeID === id) * 100,
    width: 200,
    height: 80,
  }))
  mockFixture.selectRoot(view)
  return view
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockViews.clear()
  mockFixture = createSortDragFixture(mockViews)
  const native = jest.requireActual<typeof RN>("react-native"),
    base = jest.mocked(native.findNodeHandle).getMockImplementation()!,
    tags = new WeakMap<object, number>()
  let next = 700
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    if (!view || typeof view !== "object") return base(view)
    if (!tags.has(view)) {
      const original = base(view)
      tags.set(view, original && original >= 1000000 ? original : ++next)
    }
    return tags.get(view)!
  })
})
afterEach(async () => {
  await rawAct(() => nativeVirtualDrag.cancel())
  await cleanup()
  mockFixture.dispose()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("retains the actual pinned reorder semantics, identities and empty/missing-key outcomes", () => {
  for (const source of [null, "", "name", "date", "missing"])
    for (const target of ["", "name", "date", "missing"]) {
      const expected = canonicalReorder(parameters, source, target)
      const actual = reorderNativeSortParameters(parameters, source, target)
      expect(actual).toEqual(expected)
      expect(actual === parameters).toBe(expected === parameters)
      for (const item of actual) expect(parameters.includes(item)).toBe(true)
    }
})
it("receives root aliases, native fields, defaults and all three item style owners without leaking wrapper props", async () => {
  await render(
    tree({
      nativeID: "original-list",
      ariaLabel: "Sort parameters",
      ariaLabelledBy: "first second",
      ariaDescribedBy: "description",
      ariaDetails: "details",
      customStyles: { backgroundColor: "turquoise", marginTop: 5, width: 300 },
      style: { backgroundColor: "tomato", marginBottom: 10, width: undefined },
      customItemStyles: { backgroundColor: "navy" },
      customItemIconStyles: { marginRight: 5, color: "red" },
      customItemTextStyles: { marginLeft: 10 },
    }),
  )
  const root = screen.getByTestId("sort-parameter-list")
  expect(root).toHaveStyle({ width: 250, height: 200, backgroundColor: "tomato", marginTop: 5, marginBottom: 10 })
  expect(root.props.nativeID).toBe("original-list")
  expect(root.props.nativeLabelledBy).toEqual(["first", "second"])
  expect(root.props.nativeDescribedBy).toEqual(["description"])
  expect(root.props.nativeDetailsBy).toEqual(["details"])
  for (const key of [
    "sortParameterList",
    "onSortParameterListChange",
    "customStyles",
    "customItemStyles",
    "customItemIconStyles",
    "customItemTextStyles",
  ])
    expect(root.props[key]).toBeUndefined()
  expect(rows().map((item) => item.props.nativeID)).toEqual(["name", "date"])
  expect(row("name")).toHaveStyle({ backgroundColor: "navy", width: "100%" })
  expect(within(row("name")).getByTestId("sort-parameter-list-item-icon")).toHaveStyle({ marginRight: 5 })
  expect(screen.getByText("Name")).toHaveStyle({ marginLeft: 10 })
  expect(
    screen.getAllByTestId("sort-parameter-list-item-default-drag-indicator-icon", { includeHiddenElements: true }),
  ).toHaveLength(2)
})
it("reorders locally through the original native source/target roots while the owner holds its array", async () => {
  const changed = jest.fn()
  const view = await render(tree({ onSortParameterListChange: changed }))
  const original = select("name")
  await act(() => mockFixture.lift(10, 10, "name"))
  select("date")
  await act(() => mockFixture.move(10, 170))
  await act(() => mockFixture.drop(10, 170))
  expect(changed).toHaveBeenCalledTimes(1)
  expect(changed).toHaveBeenCalledWith([parameters[1], parameters[0]])
  expect(rows().map((item) => item.props.nativeID)).toEqual(["date", "name"])
  expect(parameters.map((item) => item.ID)).toEqual(["name", "date"])
  expect(mockViews.get(row("name").props.ownerId) === original).toBe(true)
  await view.rerender(tree({ onSortParameterListChange: changed, style: { opacity: 0.75 } }))
  expect(rows().map((item) => item.props.nativeID)).toEqual(["date", "name"])
  await view.rerender(tree({ onSortParameterListChange: changed, sortParameterList: [...parameters] }))
  expect(rows().map((item) => item.props.nativeID)).toEqual(["name", "date"])
  expect(mockViews.get(row("name").props.ownerId) === original).toBe(true)
})
it("keeps optional owner callbacks independent of local ordering and uses the actual virtual drop action", async () => {
  await render(tree())
  await act(() => row("name").props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }))
  await act(() => row("date").props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }))
  expect(rows().map((item) => item.props.nativeID)).toEqual(["date", "name"])
})
it("keeps the canonical empty source ID inert and refreshes original item content by key", async () => {
  const changed = jest.fn(),
    empty: SortParameter = { ID: "", name: "Empty", sortDirection: "Ascending" }
  const view = await render(tree({ sortParameterList: [empty, parameters[1]], onSortParameterListChange: changed }))
  const original = select("")
  await act(() => mockFixture.lift(10, 10, ""))
  select("date")
  await act(() => mockFixture.drop(10, 170))
  expect(changed).not.toHaveBeenCalled()
  expect(rows().map((item) => item.props.nativeID)).toEqual(["", "date"])
  await view.rerender(
    tree({ sortParameterList: [{ ...empty, name: "Updated" }, parameters[1]], onSortParameterListChange: changed }),
  )
  expect(screen.getByText("Updated")).toBeOnTheScreen()
  expect(mockViews.get(row("").props.ownerId) === original).toBe(true)
})
it("receives an empty list and retires an original source before queued work can notify its owner", async () => {
  const changed = jest.fn()
  const view = await render(tree({ onSortParameterListChange: changed }))
  select("name")
  await act(() => mockFixture.lift(10, 10, "name"))
  await view.rerender(tree({ sortParameterList: [], onSortParameterListChange: changed }))
  expect(screen.queryByTestId("sort-parameter-list-item")).toBeNull()
  expect(screen.getByTestId("sort-parameter-list")).toBeOnTheScreen()
  expect(changed).not.toHaveBeenCalled()
})
