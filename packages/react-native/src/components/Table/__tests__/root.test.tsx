import { render as renderWithoutAdmission } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import { findNodeHandle, StyleSheet, TextInput, View } from "react-native"

import { NATIVE_DEFAULT_SLOT, NativeSelectableCollectionContext } from "../../../collection/context"
import { captureNativeFocusTarget, focusNativeTarget } from "../../../input/focus"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeKeyboardScope } from "../../../input/NativeKeyboardScope"
import { NativeThemeProvider } from "../../../theme"
import { Button } from "../../Button/Button"
import { NativeTablePropsContext, NativeTableStateContext, useNativeTable } from "../context"
import { nativeTableChildren, createNativeTableHeaderModel, createNativeTableBodyModel } from "../model"
import { Table } from "../Table"
import type { TNativeTableProps, TNativeTableRenderState } from "../types"

import { actWithNativeCollections as act, renderWithNativeCollections as render, screen } from "./collectionModel"

type TState = NonNullable<React.ContextType<typeof NativeTableStateContext>>
let state: TState
let runtime: ReturnType<typeof useNativeTable>
let flags: TNativeTableRenderState
let privateContext: React.ContextType<typeof NativeTablePropsContext>
const Probe = () => {
  state = useContext(NativeTableStateContext)!
  runtime = useNativeTable()
  privateContext = useContext(NativeTablePropsContext)
  return null
}
const items = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
]
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const renderRoot: NonNullable<TNativeTableProps["render"]> = (props, values) => {
  flags = values
  return <NativeFocusView {...props} />
}
const tree = (props: TNativeTableProps<(typeof items)[number]> = {}, rows = items) => (
  <NativeThemeProvider>
    <Table
      accessibilityLabel="People"
      render={renderRoot}
      {...props}
      items={(modelOptions) =>
        nativeTableChildren(
          createNativeTableHeaderModel(
            {
              columns: columns,
              render: (header) => (
                <View {...header}>
                  <Probe />
                  {header.children}
                </View>
              ),
            },
            modelOptions,
          ),
          createNativeTableBodyModel({ columns: columns, items: rows, rowKey: (item) => item.id }, modelOptions),
        )
      }
    />
  </NativeThemeProvider>
)
const observeFocus = async (ref: React.RefObject<View | null>, focused: boolean, visible = true, target?: number) => {
  const host = screen.getByTestId("table")
  const event = {
    nativeEvent: {
      ownerId: host.props.ownerId,
      target: target ?? findNodeHandle(ref.current),
      isFocused: focused,
      isFocusVisible: visible,
    },
  }
  await act(() => host.props.onNativeFocusChange(event))
  return event
}

it.each([false, true])(
  "preserves explicit native root focus admission on the original host with custom=%s",
  async (custom) => {
    const root = createRef<View>(),
      child = createRef<View>(),
      editor = createRef<TextInput>(),
      changed = jest.fn()
    const ownedColumns = [
      {
        ...columns[0],
        cellRenderer: ({ row }: { row: (typeof items)[number] }) =>
          row.id === "a" ? (
            <>
              <Button ref={child}>Original child</Button>
              <TextInput ref={editor} testID="root-focus-editor" value="held" onChangeText={changed} />
            </>
          ) : (
            row.name
          ),
      },
    ]
    const node = (admission: Pick<TNativeTableProps, "focusable" | "tabIndex"> = {}) => (
      <NativeThemeProvider>
        <Table
          ref={root}
          testID="root-focus-table"
          render={custom ? renderRoot : undefined}
          {...admission}
          items={(modelOptions) =>
            nativeTableChildren(
              createNativeTableHeaderModel(
                {
                  columns: columns,
                  render: (header) => (
                    <View {...header}>
                      <Probe />
                      {header.children}
                    </View>
                  ),
                },
                modelOptions,
              ),
              createNativeTableBodyModel({ items: items, columns: ownedColumns }, modelOptions),
            )
          }
        />
      </NativeThemeProvider>
    )
    const view = await render(node())
    const original = { root: root.current!, child: child.current!, editor: editor.current! },
      host = () => screen.getByTestId("root-focus-table"),
      captured = captureNativeFocusTarget(original.root),
      childCaptured = captureNativeFocusTarget(original.child),
      write = jest.spyOn(original.editor, "setNativeProps")
    expect(captured?.()).toBe(true)
    expect(childCaptured?.()).toBe(true)
    expect(host().props).toMatchObject({ accessible: false, focusable: true, role: "grid", nativeTabStop: true })
    await act(() => state.selectionManager.setFocusedKey("a"))
    expect(host().props.nativeTabStop).toBe(false)
    const cases = [
      { props: { focusable: false }, expected: false },
      { props: { tabIndex: -1 as const }, expected: false },
      { props: { focusable: false, tabIndex: 0 as const }, expected: true },
      { props: { focusable: true, tabIndex: -1 as const }, expected: false },
      { props: {}, expected: true },
    ]
    for (const { props, expected } of cases) {
      await view.rerender(node(props))
      expect(host().props.focusable).toBe(expected)
      expect(host().props.keyboardFocusable).toBe(expected)
      expect(host().props).toMatchObject({ accessible: false, role: "grid", nativeTabStop: false })
      if (expected) expect(captureNativeFocusTarget(original.root)?.()).toBe(true)
      else {
        expect(captured?.()).toBe(false)
        expect(captureNativeFocusTarget(original.root)).toBeNull()
        expect(focusNativeTarget(original.root)).toBe(false)
      }
      expect(childCaptured?.()).toBe(true)
      expect(root.current).toBe(original.root)
      expect(child.current).toBe(original.child)
      expect(editor.current).toBe(original.editor)
      expect(JSON.parse(host().props.nativeCollectionSemantics)).toMatchObject({
        kind: "root",
        rowCount: 3,
        columnCount: 1,
      })
      expect(JSON.parse(host().props.nativeCollectionBinding).lifetime).not.toBe("")
      expect(screen.getByTestId("root-focus-editor").props.value).toBe("held")
    }
    await act(() => state.selectionManager.setFocusedKey(null))
    expect(host().props.nativeTabStop).toBe(true)
    expect(changed).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  },
)

it("renders the four source fields over the real complete filtered state and keeps opaque bindings", async () => {
  await render(tree())
  expect(Object.keys(flags).sort()).toEqual(["isDropTarget", "isFocusVisible", "isFocused", "state"])
  expect(flags.state === state).toBe(true)
  expect(flags.state.collection === runtime.collection).toBe(true)
  expect(flags.state.selectionManager === runtime.manager).toBe(true)
  expect(flags.isDropTarget).toBe(false)
  const root = screen.getByTestId("table")
  expect(JSON.parse(root.props.nativeCollectionBinding)).toMatchObject({
    itemId: "",
    itemRevision: "",
    ownerId: expect.any(String),
    generation: expect.any(String),
    revision: expect.any(String),
    lifetime: expect.any(String),
  })
  expect(JSON.parse(root.props.nativeCollectionSemantics)).toMatchObject({ kind: "root", columnCount: 1, rowCount: 3 })
  expect(root.props.render).toBeUndefined()
})
it("merges root selection context before constructing selection options and preserves repeated vetoes", async () => {
  const change = jest.fn()
  await render(
    <NativeTablePropsContext.Provider
      value={{ selectionMode: "multiple", selectedKeys: new Set(), onSelectionChange: change }}
    >
      {tree()}
    </NativeTablePropsContext.Provider>,
  )
  expect(state.selectionManager.selectionMode).toBe("multiple")
  expect(privateContext).toEqual(expect.objectContaining({ selectionMode: "multiple" }))
  expect(state.collection.columns.map((column) => column.key)).toEqual(["__selection", "name"])
  await act(() => state.selectionManager.toggleSelection("a"))
  await act(() => state.selectionManager.toggleSelection("a"))
  expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([["a"], ["a"]])
  expect(state.selectionManager.isSelected("a")).toBe(false)
})
it("uses named/default slot refs and bypasses both contexts on explicit null", async () => {
  const ref = createRef<View>()
  const context = {
    slots: {
      people: { ref, id: "people-context", style: { paddingTop: 19 } },
      [NATIVE_DEFAULT_SLOT]: { id: "default-context" },
    },
  }
  const content = (slot?: string | null) => (
    <NativeTablePropsContext.Provider value={context}>
      <NativeSelectableCollectionContext.Provider value={{ style: { paddingBottom: 7 } }}>
        {tree({ slot })}
      </NativeSelectableCollectionContext.Provider>
    </NativeTablePropsContext.Provider>
  )
  const view = await render(content("people"))
  const original = ref.current
  expect(original !== null).toBe(true)
  expect(screen.getByTestId("table").props.nativeID).toBe("people-context")
  await view.rerender(content(null))
  expect(ref.current).toBeNull()
  expect(StyleSheet.flatten(screen.getByTestId("table").props.style).paddingTop).toBeUndefined()
  expect(StyleSheet.flatten(screen.getByTestId("table").props.style).paddingBottom).toBeUndefined()
  expect(screen.getByTestId("table").props.nativeID).toBe("people-context")
  await view.rerender(content())
  expect(screen.getByTestId("table").props.nativeID).toBe("default-context")
  await view.rerender(content("people"))
  expect(ref.current === original).toBe(true)
})
it("preserves source precedence and original state through context style functions", async () => {
  const calls: unknown[] = []
  const rootStyle = jest.fn((values) => {
    calls.push(values.defaultStyle)
    return { marginTop: 7, paddingTop: 7 }
  })
  await render(
    <NativeTablePropsContext.Provider value={{ style: rootStyle }}>
      <NativeSelectableCollectionContext.Provider value={{ style: { marginTop: 5, paddingBottom: 5 } }}>
        {tree({ customStyles: { marginTop: 11 }, style: { marginBottom: 12 } })}
      </NativeSelectableCollectionContext.Provider>
    </NativeTablePropsContext.Provider>,
  )
  expect(StyleSheet.flatten(screen.getByTestId("table").props.style)).toMatchObject({
    marginTop: 11,
    marginBottom: 12,
    paddingTop: 7,
    paddingBottom: 5,
  })
  expect(calls.at(-1)).toEqual({ marginTop: 5, paddingBottom: 5 })
  expect(rootStyle.mock.calls.at(-1)?.[0].state === state).toBe(true)
})
it("retains raw context sorting and action while wrapper controls stay authoritative", async () => {
  const change = jest.fn()
  const action = jest.fn()
  await render(
    <NativeTablePropsContext.Provider
      value={{ sortDescriptor: { column: "name", direction: "descending" }, onSortChange: change, onRowAction: action }}
    >
      {tree({ clickableRows: false })}
    </NativeTablePropsContext.Provider>,
  )
  expect(state.sortDescriptor).toEqual({ column: "name", direction: "descending" })
  await act(() => state.sort("name", "ascending"))
  expect(change).toHaveBeenCalledWith({ column: "name", direction: "ascending" })
  await act(() => runtime.onRowAction?.("a"))
  expect(action).toHaveBeenCalledWith("a")
})
it("chains the current raw context sort request before the source query translation", async () => {
  const order: string[] = []
  const inherited = jest.fn((_next: unknown) => order.push("context"))
  const query = jest.fn((_next: unknown) => order.push("query"))
  await render(
    <NativeTablePropsContext.Provider value={{ onSortChange: inherited }}>
      {tree({
        columns: [{ ...columns[0], sort: { enabled: true, criteriaID: "person" } }],
        queryControls: { sorting: { activeSorts: [], onSortChange: query } },
      })}
    </NativeTablePropsContext.Provider>,
  )
  await act(() => state.sort("name", "descending"))
  expect(order).toEqual(["context", "query"])
  expect(inherited.mock.calls[0][0]).toEqual({ column: "name", direction: "descending" })
  expect(query.mock.calls[0][0]).toEqual([expect.objectContaining({ sortDirection: "Ascending" })])
})
it("preserves the original root, editor and refs through default/custom rendering and owner updates", async () => {
  const root = createRef<View>()
  const editor = createRef<TextInput>()
  const owned = (custom: boolean) => (
    <NativeThemeProvider>
      <Table
        ref={root}
        render={custom ? renderRoot : undefined}
        items={(modelOptions) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns: columns }, modelOptions),
            createNativeTableBodyModel(
              {
                items: [items[0]],
                columns: [
                  { ...columns[0], cellRenderer: () => <TextInput ref={editor} testID="held-editor" value="held" /> },
                ],
              },
              modelOptions,
            ),
          )
        }
      />
    </NativeThemeProvider>
  )
  const view = await render(owned(false))
  const original = { root: root.current, editor: editor.current }
  await view.rerender(owned(true))
  expect(root.current === original.root).toBe(true)
  expect(editor.current === original.editor).toBe(true)
  expect(screen.getByTestId("held-editor").props.value).toBe("held")
  await view.rerender(owned(false))
  expect(root.current === original.root).toBe(true)
  expect(editor.current === original.editor).toBe(true)
})
it("observes actual root focus separately from logical focus and rejects foreign targets", async () => {
  const root = createRef<View>()
  const focus = jest.fn()
  const blur = jest.fn()
  await render(tree({ ref: root, onFocus: focus, onBlur: blur }, []))
  await act(() => state.selectionManager.setFocused(true))
  expect(flags.isFocused).toBe(false)
  await observeFocus(root, true, true, 999999)
  expect(flags.isFocused).toBe(false)
  expect(focus).not.toHaveBeenCalled()
  const first = await observeFocus(root, true)
  expect(flags.isFocused).toBe(true)
  expect(flags.isFocusVisible).toBe(true)
  expect(focus.mock.calls[0][0]).toBe(first)
  const last = await observeFocus(root, false)
  expect(flags.isFocused).toBe(false)
  expect(flags.isFocusVisible).toBe(false)
  expect(blur.mock.calls[0][0]).toBe(last)
})
it("refreshes visible root modality from the existing same-window keyboard scope", async () => {
  const root = createRef<View>()
  await render(
    <NativeKeyboardScope testID="root-scope" captureEnabled>
      {tree({ ref: root }, [])}
    </NativeKeyboardScope>,
  )
  const scope = screen.getByTestId("root-scope")
  await act(() =>
    scope.props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: scope.props.ownerId,
        windowId: "table-window",
        epoch: 1,
        policyRevision: scope.props.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  await observeFocus(root, true, false)
  expect(flags.isFocused).toBe(true)
  expect(flags.isFocusVisible).toBe(false)
  await act(() =>
    screen.getByTestId("root-scope").props.onNativeInputModality({
      nativeEvent: {
        ownerId: scope.props.ownerId,
        windowId: "table-window",
        epoch: 1,
        origin: "keyboard",
        timestamp: 1,
      },
    }),
  )
  expect(flags.isFocusVisible).toBe(true)
  await act(() =>
    screen.getByTestId("root-scope").props.onNativeInputModality({
      nativeEvent: {
        ownerId: scope.props.ownerId,
        windowId: "table-window",
        epoch: 1,
        origin: "pointer",
        timestamp: 2,
      },
    }),
  )
  expect(flags.isFocusVisible).toBe(false)
})

it("inherits root typography in body cells while header names retain canonical b10 bold text", async () => {
  await render(
    <NativeThemeProvider>
      <Table
        customStyles={{ fontSize: 17, fontFamily: "Helvetica", lineHeight: 23 }}
        style={{ letterSpacing: 0 }}
        items={(modelOptions) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns: columns, customStyles: { fontWeight: "700" } }, modelOptions),
            createNativeTableBodyModel(
              {
                items: [items[0]],
                columns: columns,
                customStyles: { fontSize: 19 },
                customRowStyles: { letterSpacing: 1 },
              },
              modelOptions,
            ),
          )
        }
      />
    </NativeThemeProvider>,
  )
  expect(StyleSheet.flatten(screen.getByText("Alpha").props.style)).toMatchObject({
    fontSize: 19,
    fontFamily: "Helvetica",
    lineHeight: 23,
    letterSpacing: 1,
  })
  expect(StyleSheet.flatten(screen.getByText("Name").props.style)).toMatchObject({
    fontSize: 14,
    fontWeight: "700",
  })
})

it("preserves native reference aliases, multiple source IDs and explicit empty values through custom rendering", async () => {
  const view = await render(
    tree({
      "data-testid": "root-alias",
      "aria-label": "Alias",
      accessibilityLabel: "Native",
      "aria-labelledby": "name-a name-b",
      "aria-describedby": "note-a note-b",
      "aria-details": "detail",
    }),
  )
  let root = screen.getByTestId("root-alias")
  expect(root.props.accessibilityLabel).toBe("Alias")
  expect(root.props.nativeLabelledBy).toEqual(["name-a", "name-b"])
  expect(root.props.nativeDescribedBy).toEqual(["note-a", "note-b"])
  expect(root.props.nativeDetailsBy).toEqual(["detail"])
  expect(root.props["aria-describedby"]).toBeUndefined()
  expect(root.props.ariaDescribedBy).toBeUndefined()
  expect(root.props["data-testid"]).toBeUndefined()
  await view.rerender(
    tree({
      testID: "",
      "data-testid": "root-alias",
      "aria-labelledby": "",
      ariaDescribedBy: [],
      "aria-describedby": "fallback",
      ariaDetails: "",
      "aria-details": "fallback",
    }),
  )
  root = screen.getByTestId("")
  expect(root.props.nativeLabelledBy).toEqual([])
  expect(root.props.nativeDescribedBy).toEqual([])
  expect(root.props.nativeDetailsBy).toEqual([])
})

it("retires the collection owner when its original root is replaced with a reused numeric tag", async () => {
  jest.mocked(findNodeHandle).mockImplementation(() => 777)
  const original = createRef<View>()
  let renderKey = "first"
  const renderHost: NonNullable<TNativeTableProps["render"]> = (props) => <NativeFocusView key={renderKey} {...props} />
  const model: NonNullable<TNativeTableProps["items"]> = (options) =>
    nativeTableChildren(
      createNativeTableHeaderModel({ columns }, options),
      createNativeTableBodyModel({ items, columns }, options),
    )
  const element = () => (
    <NativeThemeProvider>
      <Table ref={original} render={renderHost} items={model} />
    </NativeThemeProvider>
  )
  const view = await render(element())
  const before = original.current
  const binding = JSON.parse(screen.getByTestId("table").props.nativeCollectionBinding)
  expect(binding.lifetime).not.toBe("")
  renderKey = "replacement"
  await view.rerender(element())
  expect(original.current).not.toBe(before)
  const replacement = JSON.parse(screen.getByTestId("table").props.nativeCollectionBinding)
  expect(replacement.ownerId).toBe(binding.ownerId)
  expect(replacement.generation).toBe(binding.generation)
  expect(replacement.revision).toBe(binding.revision)
  expect(replacement.lifetime).not.toBe(binding.lifetime)
})

it("renders explicit membership without granting actions when native owner admission is absent", async () => {
  await renderWithoutAdmission(tree())
  expect(screen.getByText("Alpha")).toBeTruthy()
  expect(screen.getByText("Beta")).toBeTruthy()
  expect(screen.getByTestId("table").props.nativeCollectionBinding).toBe("")
  expect(screen.getByTestId("table-row-string:a").props.nativeCollectionBinding).toBe("")
})
