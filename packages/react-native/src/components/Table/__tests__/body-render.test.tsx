import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, View } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableBodyProps } from "../types"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
afterEach(cleanup)
type TRow = { id: string; value: string }
const items: TRow[] = [{ id: "a", value: "Data" }]
const columns = [{ id: "value", name: "Value", isRowHeader: true }]
type TRenderer = NonNullable<TNativeTableBodyProps<TRow>["render"]>

it("reports committed collection emptiness through data, loading rows, loading-empty and empty content", async () => {
  const receiver = jest.fn<ReturnType<TRenderer>, Parameters<TRenderer>>((props, state) => (
    <View {...props} style={[props.style, { opacity: state.isEmpty ? 0.5 : 1 }]} />
  ))
  const empty = jest.fn(() => "No rows")
  const content = (mode: "data" | "loading" | "loading-empty" | "empty") => (
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={columns} />
        <TableBody
          testID="body"
          columns={columns}
          items={mode === "data" ? items : []}
          isLoading={mode.startsWith("loading")}
          renderLoadingState={
            mode === "loading"
              ? () => <TableRow id="loading" item={{ id: "loading", value: "Loading" }} columns={columns} />
              : undefined
          }
          renderEmptyState={empty}
          render={receiver}
          customStyles={{ padding: 7 }}
          style={{ padding: 9 }}
        />
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(content("data"))
  const state = () => receiver.mock.calls.at(-1)![1]
  expect(state()).toEqual({ isEmpty: false, isDropTarget: false })
  expect(screen.getByTestId("body")).toHaveStyle({ padding: 9, opacity: 1 })
  expect(screen.getByText("Data")).toBeOnTheScreen()
  await view.rerender(content("loading"))
  expect(state().isEmpty).toBe(false)
  expect(screen.getByText("Loading")).toBeOnTheScreen()
  expect(screen.queryByText("Data")).toBeNull()
  await view.rerender(content("loading-empty"))
  expect(state().isEmpty).toBe(true)
  expect(empty).not.toHaveBeenCalled()
  expect(screen.queryByText("Loading")).toBeNull()
  await view.rerender(content("empty"))
  expect(state()).toEqual({ isEmpty: true, isDropTarget: false })
  expect(screen.getByText("No rows")).toBeOnTheScreen()
  expect(empty).toHaveBeenCalledWith({ isEmpty: true, isDropTarget: false })
  expect(screen.getByTestId("body")).toHaveStyle({ padding: 9, opacity: 0.5 })
  expect(screen.getByTestId("body").props.render).toBeUndefined()
})

it("retains the original body and held editor when inserting and replacing the renderer", async () => {
  const body = createRef<View>(),
    editor = createRef<TextInput>()
  const metadata = [
    {
      id: "value",
      name: "Value",
      isRowHeader: true,
      cellRenderer: () => <TextInput ref={editor} testID="held" value="" selection={{ start: 0, end: 0 }} />,
    },
  ]
  const first: TRenderer = (props) => <View {...props} style={[props.style, { opacity: 0.8 }]} />
  const second: TRenderer = (props) => <View {...props} style={[props.style, { opacity: 0 }]} />
  const content = (renderer?: TRenderer) => (
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={metadata} />
        <TableBody ref={body} testID="body" items={items} columns={metadata} render={renderer} />
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(content())
  const originalBody = body.current,
    originalEditor = editor.current!
  const write = jest.spyOn(originalEditor, "setNativeProps")
  await view.rerender(content(first))
  expect(body.current).toBe(originalBody)
  expect(editor.current).toBe(originalEditor)
  await view.rerender(content(second))
  expect(body.current).toBe(originalBody)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("body")).toHaveStyle({ opacity: 0 })
  expect(screen.getByTestId("held").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
  expect(write).not.toHaveBeenCalled()
})

it("delivers callback-ref cleanup only when the body host is removed", async () => {
  const release = jest.fn(),
    ref = jest.fn((_target: View | null) => release)
  const receiver: TRenderer = (props) => <View {...props} />
  const content = (data: TRow[]) => (
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={columns} />
        <TableBody ref={ref} columns={columns} items={data} render={receiver} />
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(content(items))
  await view.rerender(content([]))
  expect(ref).toHaveBeenCalledTimes(1)
  expect(release).not.toHaveBeenCalled()
  await view.unmount()
  expect(release).toHaveBeenCalledTimes(1)
})
