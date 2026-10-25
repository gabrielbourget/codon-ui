import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, type Ref } from "react"
import { findNodeHandle, TextInput, type View } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
afterEach(cleanup)

const items = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
]
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const tree = (ref: Ref<View>, reverse = false) => (
  <NativeThemeProvider>
    <Table ref={ref} accessibilityLabel="People">
      <TableHeader columns={columns} />
      <TableBody items={reverse ? [...items].reverse() : items} columns={columns} />
    </Table>
  </NativeThemeProvider>
)

it("exposes the original semantic grid host and clears its object ref on unmount", async () => {
  const ref = createRef<View>()
  const view = await render(tree(ref))
  const original = ref.current!
  expect(original).not.toBeNull()
  const cells = screen.container.queryAll(
    (host) => JSON.parse(host.props.nativeCollectionSemantics || "null")?.kind === "cell",
  )
  expect(cells.length).toBeGreaterThan(0)
  expect(
    cells.every((cell) => JSON.parse(cell.props.nativeCollectionSemantics).parentTarget === findNodeHandle(original)),
  ).toBe(true)
  await view.rerender(tree(ref, true))
  expect(ref.current).toBe(original)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("consumes source-inert root geometry while leaving body and row geometry authoritative", async () => {
  await render(
    <NativeThemeProvider>
      <Table geometry="orthogonal">
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} geometry="round" />
      </Table>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("table").props.geometry).toBeUndefined()
  const cell = screen.container.queryAll(
    (host) => JSON.parse(host.props.nativeCollectionSemantics || "null")?.rowIndex === 1,
  )[0]
  expect(cell).toHaveStyle({ borderTopLeftRadius: 10000, borderTopRightRadius: 10000 })
})

it("hands callback refs the same original host and runs React19 cleanup once per owner", async () => {
  const firstCleanup = jest.fn(),
    secondCleanup = jest.fn()
  const first = jest.fn((_target: View | null) => firstCleanup)
  const second = jest.fn((_target: View | null) => secondCleanup)
  const view = await render(tree(first))
  const original = first.mock.calls[0][0]
  expect(original).not.toBeNull()
  expect(first).toHaveBeenCalledTimes(1)
  await view.rerender(tree(second, true))
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledWith(original)
  await view.unmount()
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(secondCleanup).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})

it("retains an embedded editor through root ref handoff and delivers null to a conventional callback", async () => {
  const ref = createRef<View>(),
    editor = createRef<TextInput>()
  const callback = jest.fn((_target: View | null) => undefined)
  const metadata = [
    {
      id: "name",
      name: "Name",
      isRowHeader: true,
      cellRenderer: () => <TextInput ref={editor} testID="held" value="held" />,
    },
  ]
  const content = (root: Ref<View>) => (
    <NativeThemeProvider>
      <Table ref={root}>
        <TableHeader columns={metadata} />
        <TableBody items={items} columns={metadata} />
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(content(ref))
  const originalRoot = ref.current,
    originalEditor = editor.current!
  const write = jest.spyOn(originalEditor, "setNativeProps")
  await view.rerender(content(callback))
  expect(ref.current).toBeNull()
  expect(callback).toHaveBeenCalledWith(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getAllByTestId("held").every((host) => host.props.value === "held")).toBe(true)
  expect(write).not.toHaveBeenCalled()
  await view.unmount()
  expect(callback.mock.calls.map(([target]) => target)).toEqual([originalRoot, null])
})
