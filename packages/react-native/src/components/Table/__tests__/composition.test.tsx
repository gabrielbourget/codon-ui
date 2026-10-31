import "../../../collection/__tests__/nativeReceipts"

import { createRef, useEffect, useState } from "react"
import type { TextInput, View } from "react-native"

import {
  Input,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Table,
  TableBody,
  TableHeader,
  type TableColumnMetadata,
} from "../../.."
import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"

it("receives asynchronous public Table rows while retaining the original selected row editor and issuing no selection request", async () => {
  const initial = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
  ]
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    onSelectionChange = jest.fn()
  let receive!: (items: typeof initial) => void
  const response = new Promise<typeof initial>((resolve) => {
    receive = resolve
  })
  const Owner = () => {
    const [items, setItems] = useState(initial)
    const [draft, setDraft] = useState("held")
    useEffect(() => {
      let mounted = true
      void response.then((next) => {
        if (mounted) setItems(next)
      })
      return () => {
        mounted = false
      }
    }, [])
    const columns: TableColumnMetadata<(typeof initial)[number]>[] = [
      { id: "name", name: "Name", width: 100, isRowHeader: true },
      {
        id: "editor",
        name: "Editor",
        width: 180,
        cellRenderer: ({ row }) =>
          row.id === "a" ? (
            <Input ref={editor} testID="async-table-editor" value={draft} onChangeText={setDraft} />
          ) : null,
      },
    ]
    return (
      <NativeThemeProvider>
        <NativeOverlayProvider>
          <NativeFloatingLayerHost>
            <Table
              ref={root}
              accessibilityLabel="Asynchronous owner rows"
              columns={columns}
              selectionMode="multiple"
              selectedKeys={["a"]}
              onSelectionChange={onSelectionChange}
            >
              <TableHeader columns={columns} />
              <TableBody items={items} columns={columns} />
            </Table>
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    )
  }
  const view = await render(<Owner />)
  const originalRoot = root.current,
    originalEditor = editor.current
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  await fireEvent.changeText(screen.getByTestId("async-table-editor"), "retained draft")
  await act(async () => {
    receive([...initial].reverse().map((item) => ({ ...item, name: `${item.name} resolved` })))
    await response
  })
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("async-table-editor")).toHaveDisplayValue("retained draft")
  expect(screen.getByText("Alpha resolved")).toBeOnTheScreen()
  expect(screen.getByTestId("table-row-string:a").props.accessibilityState.selected).toBe(true)
  expect(onSelectionChange).not.toHaveBeenCalled()
  await view.unmount()
  expect(root.current).toBeNull()
  expect(editor.current).toBeNull()
})
