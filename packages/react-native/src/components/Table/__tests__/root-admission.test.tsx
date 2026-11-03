import { render } from "@testing-library/react-native"
import { createRef, memo, useLayoutEffect } from "react"
import { TextInput, type View } from "react-native"

import { confirmNativeCollections } from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable, type TNativeTableContext } from "../context"
import { createNativeTableBodyModel, createNativeTableHeaderModel, nativeTableChildren } from "../model"
import { Table } from "../Table"

it("updates the original root receipt without rebuilding unchanged Table state and refreshes controlled state normally", async () => {
  const root = createRef<View>()
  const editor = createRef<TextInput>()
  const rendered = jest.fn()
  let current: TNativeTableContext | undefined
  const Probe = memo(() => {
    const table = useNativeTable()
    rendered(table)
    useLayoutEffect(() => {
      current = table
    }, [table])
    return <TextInput ref={editor} testID="receipt-editor" value="held" />
  })
  const columns = [{ id: "name", name: "Name", isRowHeader: true }]
  const rows = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
  ]
  const items: NonNullable<React.ComponentProps<typeof Table>["items"]> = (options) =>
    nativeTableChildren(
      createNativeTableHeaderModel(
        {
          columns,
          render: (host) => (
            <NativeFocusView {...host}>
              <Probe />
              {host.children}
            </NativeFocusView>
          ),
        },
        options,
      ),
      createNativeTableBodyModel({ columns, items: rows }, options),
    )
  const tree = (selected: string[] = []) => (
    <NativeThemeProvider>
      <Table ref={root} testID="receipt-table" selectionMode="multiple" selectedKeys={selected} items={items} />
    </NativeThemeProvider>
  )
  const view = await render(tree())
  const originalRoot = root.current
  const originalEditor = editor.current
  const state = current
  const calls = rendered.mock.calls.length
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(view.getByTestId("receipt-table").props.nativeCollectionBinding).toBe("")
  await confirmNativeCollections(view)
  expect(view.getByTestId("receipt-table").props.nativeCollectionBinding).not.toBe("")
  expect(rendered).toHaveBeenCalledTimes(calls)
  expect(current).toBe(state)
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  await view.rerender(tree(["b"]))
  expect([...current!.manager.selectedKeys]).toEqual(["b"])
  expect(current).not.toBe(state)
  expect(rendered.mock.calls.length).toBeGreaterThan(calls)
  const afterControlledUpdate = rendered.mock.calls.length
  await confirmNativeCollections(view)
  expect(rendered).toHaveBeenCalledTimes(afterControlledUpdate)
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  await view.unmount()
  expect(root.current).toBeNull()
  expect(editor.current).toBeNull()
})
