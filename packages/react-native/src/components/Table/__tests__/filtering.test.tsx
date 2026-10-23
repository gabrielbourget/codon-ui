import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeForm } from "../../../form/NativeForm"
import { NativeFormRegistry } from "../../../form/registry"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { Input } from "../../Input/Input"
import type { TTableFilterGroup } from "../queryTypes"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableFilterPopover, type TNativeTableFilterPopoverProps } from "../TableFilterPopover"
import { TableHeader } from "../TableHeader"
import type { TNativeTableColumnMetadata, TNativeTableFilteringControls } from "../types"

const mockRead = jest.fn<Promise<string>, [string]>()
jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native/Libraries/Components/Pressable/Pressable", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Original = jest.requireActual("react-native/Libraries/Components/Pressable/Pressable").default
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.PressableProps>((props, ref) => {
      const previous = React.useRef<RN.View | null>(null)
      const bind = React.useCallback(
        (view: RN.View | null) => {
          if (previous.current) mockOriginalViews.delete(previous.current)
          previous.current = view
          if (view) mockOriginalViews.add(view)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref],
      )
      return <Original {...props} ref={bind} />
    }),
  }
})
jest.mock("../../../input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: { getSnapshot: (request: string) => mockRead(request) },
}))
jest.mock("../../../input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps>((props, ref) => {
      const previous = React.useRef<RN.View | null>(null)
      const bind = React.useCallback(
        (view: RN.View | null) => {
          if (previous.current) mockOriginalViews.delete(previous.current)
          previous.current = view
          if (view) mockOriginalViews.add(view)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref],
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
const mockOriginalViews = new Set<RN.View>()
const hosts = new Map<number, RN.View & { props?: { nativeFormActionBinding?: string } }>()
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextTag = 200,
  nextFrame = 0
beforeEach(() => {
  jest.useFakeTimers()
  mockRead.mockReset()
  hosts.clear()
  frames.clear()
  mockOriginalViews.clear()
  const native = jest.requireActual<typeof RN>("react-native")
  jest.spyOn(native.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const base = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const targets = new WeakMap<object, number>()
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    if (!view || typeof view !== "object") return base(view)
    let tag = targets.get(view)
    if (!tag) {
      const previous = base(view)
      tag = previous && previous >= 1000000 ? previous : ++nextTag
      targets.set(view, tag)
    }
    hosts.set(tag, view as RN.View)
    return tag
  })
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const columns = [
  {
    id: "name",
    name: "Name",
    isRowHeader: true,
    sort: { enabled: true, criteriaID: "name" },
    filter: {
      enabled: true,
      criteriaID: "person",
      queryKey: "user.name",
      allowedOperationCodes: ["equal", "not-equal", "like"],
    },
  },
] satisfies TNativeTableColumnMetadata<{ id: string; name: string }>[]
const group = (argument = "applied"): TTableFilterGroup => ({
  id: "applied-id",
  criteriaID: "person",
  criteriaName: "Old name",
  dataType: "text",
  joinOperator: "or",
  clauses: [{ id: "held-clause", operationCode: "equal", argument }],
})
// Explicit original responder phases avoid the test renderer's logical portal parent intercepting presses.
const press = async (name: string, index = 0) => {
  const button = screen.getAllByRole("button", { name, includeHiddenElements: true })[index]
  const original = [...mockOriginalViews].find((view) => {
    const props = (view as RN.View & { props: Record<string, unknown> }).props
    return props.ownerId === button.props.ownerId && props.onResponderRelease === button.props.onResponderRelease
  })!
  expect(original).toBeDefined()
  const target = jest.requireActual<typeof RN>("react-native").findNodeHandle(original)!
  let prevented = false
  const event = {
    target,
    currentTarget: target,
    nativeEvent: { target, timestamp: 100, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
    persist: jest.fn(),
    get defaultPrevented() {
      return prevented
    },
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
  await act(() => button.props.onResponderGrant(event))
  await act(() => jest.advanceTimersByTime(130))
  await act(() => button.props.onResponderRelease(event))
  await act(() => {})
}
const headerNode = (
  filtering: TNativeTableFilteringControls,
  header: TNativeTableColumnMetadata<{ id: string; name: string }>[] = columns,
) => (
  <NativeThemeProvider>
    <Table queryControls={{ sorting: { activeSorts: [], onSortChange: jest.fn() }, filtering }}>
      <TableHeader columns={header} />
      <TableBody items={[{ id: "a", name: "Alpha" }]} columns={columns} />
    </Table>
  </NativeThemeProvider>
)
it("preserves current external callback payloads and held active filters without sorting", async () => {
  const changed = jest.fn(),
    applied = group()
  const view = await render(headerNode({ activeFilters: [applied], onFilterIconPress: changed }))
  expect(screen.getByRole("button", { name: "Filter by Name" }).props.accessibilityState.checked).toBe(true)
  await press("Filter by Name")
  await press("Filter by Name")
  expect(changed.mock.calls).toEqual([
    [{ columnID: "name", columnName: "Name", filterGroup: applied }],
    [{ columnID: "name", columnName: "Name", filterGroup: applied }],
  ])
  expect(changed.mock.calls[0][0].filterGroup).toBe(applied)
  await view.rerender(headerNode({ activeFilters: [], mode: "external", onFilterIconPress: changed }))
  await press("Filter by Name")
  expect(changed).toHaveBeenLastCalledWith({ columnID: "name", columnName: "Name", filterGroup: undefined })
})
it("keeps filtering inert without a handler, suppresses hidden headers and preserves explicit icon overrides", async () => {
  const changed = jest.fn()
  const view = await render(headerNode({ activeFilters: [] }))
  expect(screen.queryByRole("button", { name: "Filter by Name" })).toBeNull()
  await view.rerender(
    headerNode({ activeFilters: [], onFilterIconPress: changed }, [{ ...columns[0], headerVisuallyHidden: true }]),
  )
  expect(screen.queryByRole("button", { name: "Filter by Name" })).toBeNull()
  await view.rerender(headerNode({ activeFilters: [], onFilterIconPress: changed, icons: { inactive: 0 } }))
  expect(screen.getByText("0")).toBeOnTheScreen()
  expect(screen.queryByTestId("table-header-default-inactive-filter-icon", { includeHiddenElements: true })).toBeNull()
})

const setup = async (initial: Partial<TNativeTableFilterPopoverProps<object>> = {}, asTable = false) => {
  const registry = new NativeFormRegistry(),
    host = createRef<RN.View>(),
    outside = jest.fn(),
    changed = jest.fn()
  const editor = createRef<RN.TextInput>()
  let accepted = true
  const node = (props = initial) => (
    <NativeThemeProvider>
      <NativeFormRegistryContext.Provider value={registry}>
        <NativeOverlayProvider>
          <NativeFloatingLayerHost ref={host} testID="filter-host">
            <NativeForm id="outer" onSubmit={outside}>
              {asTable ? (
                <Table
                  columns={columns}
                  filteringLabels={props.labels}
                  queryControls={{
                    filtering: {
                      mode: "popover",
                      activeFilters: props.activeFilters ?? [],
                      onFiltersChange: props.onFiltersChange ?? changed,
                    },
                  }}
                >
                  <TableHeader columns={columns} />
                  <TableBody
                    items={[{ id: "a", name: "Alpha" }]}
                    columns={columns}
                    renderCell={() => <Input ref={editor} accessibilityLabel="Held table draft" value="held" />}
                  />
                </Table>
              ) : (
                <TableFilterPopover
                  column={columns[0]}
                  activeFilters={[]}
                  onFiltersChange={changed}
                  isFilterActive={false}
                  activeFilterIcon="Active"
                  inactiveFilterIcon="Inactive"
                  {...props}
                />
              )}
            </NativeForm>
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      </NativeFormRegistryContext.Provider>
    </NativeThemeProvider>
  )
  const view = await render(node())
  const ready = async () => {
    for (const original of new Set([...hosts.values(), ...mockOriginalViews]))
      Object.defineProperty(original, "measureInWindow", {
        configurable: true,
        value: jest.fn((callback: (x: number, y: number, w: number, h: number) => void) => callback(20, 40, 260, 240)),
      })
    Object.defineProperty(host.current!, "measureInWindow", {
      configurable: true,
      value: jest.fn((callback: (x: number, y: number, w: number, h: number) => void) => callback(0, 0, 360, 640)),
    })
    await fireEvent(screen.getByTestId("filter-host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    for (const ready of [false, true]) {
      const props = screen.getByTestId("filter-host").props
      await act(() =>
        props.onNativeScopeStatus({
          nativeEvent: {
            ownerId: props.ownerId,
            windowId: "filter-window",
            epoch: 1,
            policyRevision: props.policyRevision,
            ready,
            windowActive: true,
          },
        }),
      )
    }
    for (let count = 0; count < 3; count++)
      await act(() => {
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach((callback) => callback(0))
      })
    const surface = screen.getByTestId("click-popover", { includeHiddenElements: true })
    expect(surface.parent!.props.accessibilityElementsHidden).toBe(false)
    expect(jest.requireActual<typeof RN>("react-native").StyleSheet.flatten(surface.props.style)?.opacity).not.toBe(0)
  }
  const actionStatus = async () => {
    const action = screen.container.queryAll((item) => !!item.props.nativeFormActionBinding)[0]
    const binding = JSON.parse(action.props.nativeFormActionBinding)
    const target = [...hosts].find(
      ([, view]) => view.props?.nativeFormActionBinding === action.props.nativeFormActionBinding,
    )?.[0]
    expect(target).toBeDefined()
    const status = {
      ...binding,
      viewOwnerId: action.props.ownerId,
      target,
      surfaceId: 11,
      windowId: "filter-window",
      epoch: 1,
      sequence: 1,
      scopeOwnerId: "",
      scopeEpoch: 0,
      attached: true,
      active: true,
      enabled: true,
    }
    await act(() => action.props.onNativeFormActionStatus({ nativeEvent: status }))
    mockRead.mockImplementation(async (encoded) => {
      const request = JSON.parse(encoded)
      const forms = [...registry.forms.values()]
      const filtered = forms.find((form) => form.descriptor.formId !== "outer")!
      const nodes = [{ target: 1, parent: 0, component: "RootView", hidden: false, displayNone: false }]
      const formNodes = forms.map(({ descriptor }) => {
        nodes.push({ target: descriptor.target, parent: 1, component: "View", hidden: false, displayNone: false })
        nodes.push({
          target: descriptor.metadataTarget,
          parent: descriptor.target,
          component: "CUIFormRoot",
          hidden: false,
          displayNone: false,
        })
        return { ...descriptor, position: nodes.length - 1 }
      })
      nodes.push({
        target: target!,
        parent: filtered.descriptor.target,
        component: "CUIFocusView",
        hidden: false,
        displayNone: false,
      })
      expect(registry.fields.size).toBe(0)
      return JSON.stringify({
        ...request,
        documentId: "filter-model",
        revision: "1",
        rootTarget: 1,
        surfaceId: 11,
        nodes,
        forms: formNodes,
        fields: [],
        ...(request.actionAdmission
          ? {
              actionAdmission: {
                accepted,
                lease: status,
                documentId: "filter-model",
                revision: "1",
                formDescriptorId: filtered.descriptor.descriptorId,
                formDescriptorRevision: filtered.descriptor.descriptorRevision,
              },
            }
          : {}),
      })
    })
  }
  const open = async (name = "Filter by Name") => {
    await press(name)
    await ready()
  }
  return {
    changed,
    outside,
    view,
    node,
    ready,
    open,
    actionStatus,
    editor,
    reject: () => {
      accepted = false
    },
  }
}
it("edits an isolated draft and applies through the original native form action without submitting the parent", async () => {
  const f = await setup({ filterGroup: group(), activeFilters: [group()] })
  await f.open()
  const input = screen.getByLabelText("Filter Name", { includeHiddenElements: true })
  await fireEvent.changeText(input, "  requested  ")
  expect(f.changed).not.toHaveBeenCalled()
  await f.actionStatus()
  await press("Apply")
  expect(f.changed).toHaveBeenCalledWith([
    {
      id: "person",
      criteriaID: "person",
      criteriaName: "Name",
      queryKey: "user.name",
      dataType: "text",
      joinOperator: "or",
      clauses: [{ id: "held-clause", operationCode: "equal", argument: "requested" }],
    },
  ])
  expect(f.outside).not.toHaveBeenCalled()
  await f.open()
  expect(screen.getByLabelText("Filter Name", { includeHiddenElements: true }).props.text).toBe("  requested  ")
  const confirmed = group("confirmed")
  await f.view.rerender(f.node({ filterGroup: confirmed, activeFilters: [confirmed] }))
  await f.ready()
  expect(screen.getByLabelText("Filter Name", { includeHiddenElements: true }).props.text).toBe("confirmed")
  expect(f.changed).toHaveBeenCalledTimes(1)
})
it("uses the latest owner filters on clear and retains unrelated groups", async () => {
  const other = { ...group("other"), id: "other", criteriaID: "other" }
  const applied = group(),
    oldOwner = [other, applied, group("duplicate")]
  const f = await setup({ filterGroup: applied, activeFilters: oldOwner })
  await f.open()
  await fireEvent.changeText(screen.getByLabelText("Filter Name", { includeHiddenElements: true }), "local draft")
  const latest = { ...other, id: "latest" }
  await f.view.rerender(f.node({ filterGroup: applied, activeFilters: [latest, applied] }))
  await f.ready()
  expect(screen.getByLabelText("Filter Name", { includeHiddenElements: true }).props.text).toBe("local draft")
  await press("Clear")
  expect(f.changed).toHaveBeenCalledWith([latest])
  expect(f.changed.mock.calls[0][0][0]).toBe(latest)
  expect(oldOwner).toEqual([other, applied, group("duplicate")])
  expect(f.outside).not.toHaveBeenCalled()
})
it("rejects native submit admission without emitting a filter request", async () => {
  const f = await setup()
  await f.open()
  await f.actionStatus()
  f.reject()
  await press("Apply")
  expect(f.changed).not.toHaveBeenCalled()
})
it("renders add, join, delete, label and slot owners through the actual popover", async () => {
  const f = await setup({
    labels: {
      popover: {
        title: "Column filters",
        addConditionButtonAriaLabel: "Add rule",
        applyButton: "Confirm",
        joinOperators: { or: "Any rule" },
      },
      filterClause: { conditionLabel: "Localized condition", operations: { equal: "Matches exactly" } },
      argumentInput: { label: "Local argument" },
    },
    customStyles: { minWidth: 260 },
    style: { maxWidth: 300 },
    customTitleRowStyles: { marginBottom: 5 },
    customClauseListStyles: { rowGap: 10 },
    customActionsStyles: { marginTop: 5 },
  })
  await f.open()
  expect(screen.getByText("Column filters", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.getByText("Localized condition", { includeHiddenElements: true })).toBeOnTheScreen()
  await press("Add rule")
  await f.ready()
  expect(screen.getByRole("button", { name: "Any rule", includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.getAllByTestId("filter-clause-row", { includeHiddenElements: true })).toHaveLength(2)
  await press("Any rule")
  expect(
    screen.getByRole("button", { name: "Any rule", includeHiddenElements: true }).props.accessibilityState.checked,
  ).toBe(true)
  await fireEvent.changeText(screen.getAllByLabelText("Filter Name", { includeHiddenElements: true })[0], "first")
  await press("Delete Filter Entry", 1)
  expect(screen.getAllByTestId("filter-clause-row", { includeHiddenElements: true })).toHaveLength(1)
  expect(screen.getByTestId("table-filter-popover", { includeHiddenElements: true })).toHaveStyle({
    minWidth: 260,
    maxWidth: 300,
  })
  expect(screen.getByTestId("table-filter-title-row", { includeHiddenElements: true })).toHaveStyle({ marginBottom: 5 })
  expect(screen.getByTestId("table-filter-clause-list", { includeHiddenElements: true })).toHaveStyle({ rowGap: 10 })
  expect(screen.getByTestId("table-filter-actions", { includeHiddenElements: true })).toHaveStyle({ marginTop: 5 })
  await f.actionStatus()
  await press("Confirm")
  expect(f.changed.mock.calls[0][0][0]).toMatchObject({
    joinOperator: "or",
    clauses: [{ id: "person-clause-1", operationCode: "equal", argument: "first" }],
  })
})
it("preserves the canonical unavailable typeahead state without inventing an input", async () => {
  const search = jest.fn()
  const f = await setup({
    column: {
      ...columns[0],
      filter: { ...columns[0].filter, usesTypeAheadInput: true, typeAheadInputOnChange: search },
    },
    labels: { argumentInput: { typeAheadSearchUnavailable: "Typeahead filters unavailable" } },
  })
  await f.open()
  expect(screen.getByText("Typeahead filters unavailable", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.queryByRole("textbox", { includeHiddenElements: true })).toBeNull()
  expect(search).not.toHaveBeenCalled()
})

it("hydrates a false option through an explicit empty selected key", async () => {
  const applied: TTableFilterGroup = {
    ...group(),
    clauses: [{ id: "false-clause", operationCode: "equal", argument: false }],
  }
  const f = await setup({
    column: {
      ...columns[0],
      filter: {
        ...columns[0].filter,
        usesSelectInput: true,
        availableCriteriaArguments: [
          { id: "", name: "False", argumentValue: false },
          { id: "zero", name: "Zero", argumentValue: 0 },
        ],
      },
    },
    filterGroup: applied,
    activeFilters: [applied],
  })
  await f.open()
  expect(
    screen.getByRole("button", { name: "Filter Argument", includeHiddenElements: true }).props.accessibilityValue,
  ).toEqual({ text: "False" })
})

it("opens filtering through the Table header and retains the original held body editor after apply", async () => {
  const f = await setup({}, true)
  const original = f.editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await f.open()
  await fireEvent.changeText(screen.getByLabelText("Filter Name", { includeHiddenElements: true }), "requested")
  await f.actionStatus()
  await press("Apply")
  expect(f.changed.mock.calls[0][0][0].clauses[0].argument).toBe("requested")
  expect(f.editor.current).toBe(original)
  expect(screen.getByLabelText("Held table draft", { includeHiddenElements: true }).props.text).toBe("held")
  expect(write).not.toHaveBeenCalled()
  expect(f.outside).not.toHaveBeenCalled()
})
