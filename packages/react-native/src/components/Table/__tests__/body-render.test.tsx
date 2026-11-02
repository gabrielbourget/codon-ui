import { cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, View } from "react-native"

import { NativeThemeProvider } from "../../../theme"
import {
  nativeTableChildren,
  createNativeTableHeaderModel,
  createNativeTableRowModel,
  createNativeTableBodyModel,
} from "../model"
import { Table } from "../Table"
import type { TNativeTableBodyProps } from "../types"

import { renderWithNativeCollections as render, screen } from "./collectionModel"

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
      <Table
        items={(modelOptions) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns: columns }, modelOptions),
            createNativeTableBodyModel(
              {
                testID: "body",
                columns: columns,
                items: mode === "data" ? items : [],
                isLoading: mode.startsWith("loading"),
                renderEmptyState: empty,
                render: receiver,
                customStyles: { padding: 7 },
                style: { padding: 9 },
              },
              modelOptions,
              mode === "loading"
                ? [
                    createNativeTableRowModel(
                      { id: "loading", item: { id: "loading", value: "Loading" }, columns },
                      modelOptions,
                    ),
                  ]
                : undefined,
            ),
          )
        }
      />
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
      <Table
        items={(modelOptions) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns: metadata }, modelOptions),
            createNativeTableBodyModel(
              { ref: body, testID: "body", items: items, columns: metadata, render: renderer },
              modelOptions,
            ),
          )
        }
      />
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
      <Table
        items={(modelOptions) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns: columns }, modelOptions),
            createNativeTableBodyModel({ ref: ref, columns: columns, items: data, render: receiver }, modelOptions),
          )
        }
      />
    </NativeThemeProvider>
  )
  const view = await render(content(items))
  await view.rerender(content([]))
  expect(ref).toHaveBeenCalledTimes(1)
  expect(release).not.toHaveBeenCalled()
  await view.unmount()
  expect(release).toHaveBeenCalledTimes(1)
})

it("renders ordinary loading presentation without discovering logical rows from it", async () => {
  await render(
    <NativeThemeProvider>
      <Table
        items={(options) => [
          createNativeTableHeaderModel({ columns }, options),
          createNativeTableBodyModel(
            { columns, isLoading: true, renderLoadingState: () => "Loading content" },
            options,
          ),
        ]}
      />
    </NativeThemeProvider>,
  )
  expect(screen.getByText("Loading content")).toBeTruthy()
  expect(screen.queryByTestId("table-row-string:loading")).toBeNull()
})
