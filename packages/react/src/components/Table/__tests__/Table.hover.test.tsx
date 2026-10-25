import { act, fireEvent, render, waitFor } from "@testing-library/react"
import type { ComponentPropsWithRef, ReactNode } from "react"
import { Cell, Row, TableBody, type CellRenderProps } from "react-aria-components"
import { afterEach, expect, it, vi } from "vitest"

import Card from "../../Card/Card"
import type { TCellProps } from "../components/TableCell/helpers"
import TableCell from "../components/TableCell/TableCell"
import TableHeader from "../components/TableHeader/TableHeader"
import TableRow from "../components/TableRow/TableRow"
import type { TTableColumnMetadata } from "../helpers"
import Table from "../Table"

afterEach(() => vi.unstubAllGlobals())
const columns: TTableColumnMetadata<{ name: string }>[] = [{ id: "name", name: "Name", isRowHeader: true }]
const pointer = (type: string) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 20, clientY: 30 })
  Object.defineProperties(event, {
    pointerType: { value: "mouse" },
    pointerId: { value: 1 },
    isPrimary: { value: true },
    relatedTarget: { value: document.body },
  })
  return event
}

it("observes actual Motion and raw RAC hover positive controls with the same pointer sequence", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent)
  const motionStart = vi.fn(),
    rawStart = vi.fn()
  const view = render(
    <>
      <Card data-testid="card" onHoverStart={motionStart}>
        Card
      </Card>
      <Table aria-label="Raw source" selectionMode="single" selectionBehavior="replace">
        <TableHeader columns={columns} />
        <TableBody>
          <Row data-testid="raw-row" id="raw" onHoverStart={rawStart}>
            <Cell>Raw</Cell>
          </Row>
        </TableBody>
      </Table>
    </>,
  )
  for (const id of ["card", "raw-row"]) {
    const element = view.getByTestId(id)
    fireEvent(element, pointer("pointerover"))
    fireEvent(element, pointer("pointerenter"))
  }
  await waitFor(() => expect(motionStart).toHaveBeenCalledTimes(1))
  expect(rawStart).toHaveBeenCalledTimes(1)
})

it("provides actual Header hover callbacks and live render state through the canonical wrapper", () => {
  vi.stubGlobal("PointerEvent", MouseEvent)
  const start = vi.fn(),
    end = vi.fn(),
    change = vi.fn()
  const view = render(
    <Table aria-label="Source">
      <TableHeader
        columns={columns}
        onHoverStart={start}
        onHoverEnd={end}
        onHoverChange={change}
        render={(props, state) => (
          <thead {...(props as ComponentPropsWithRef<"thead">)} data-testid="header" data-hovered={state.isHovered} />
        )}
      />
      <TableBody>
        <TableRow id="a" item={{ name: "Alpha" }} columns={columns} />
      </TableBody>
    </Table>,
  )
  const header = view.getByTestId("header")
  fireEvent(header, pointer("pointerover"))
  expect(header).toHaveAttribute("data-hovered", "true")
  expect(start).toHaveBeenCalledWith({ type: "hoverstart", pointerType: "mouse", target: header })
  fireEvent(header, pointer("pointerout"))
  expect(header).toHaveAttribute("data-hovered", "false")
  expect(end).toHaveBeenCalledWith({ type: "hoverend", pointerType: "mouse", target: header })
  expect(change.mock.calls).toEqual([[true], [false]])
})

it.each([
  { mode: "none" as const, disabled: false, change: [] },
  { mode: "single" as const, disabled: true, change: [] },
  { mode: "single" as const, disabled: false, change: [[true], [false]] },
])(
  "records current wrapped-row callback ownership for $mode/disabled=$disabled",
  async ({ mode, disabled, change: expectedChange }) => {
    vi.stubGlobal("PointerEvent", MouseEvent)
    const start = vi.fn(),
      end = vi.fn(),
      change = vi.fn()
    const view = render(
      <Table aria-label="Source" selectionMode={mode} disabledKeys={disabled ? ["a"] : []}>
        <TableHeader columns={columns} />
        <TableBody>
          <TableRow
            data-testid="row"
            id="a"
            item={{ name: "Alpha" }}
            columns={columns}
            onHoverStart={start}
            onHoverEnd={end}
            onHoverChange={change}
          />
        </TableBody>
      </Table>,
    )
    const row = view.getByTestId("row")
    fireEvent(row, pointer("pointerover"))
    fireEvent(row, pointer("pointerenter"))
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    expect(start).not.toHaveBeenCalled()
    fireEvent(row, pointer("pointerout"))
    fireEvent(row, pointer("pointerleave"))
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    expect(end).not.toHaveBeenCalled()
    expect(change.mock.calls).toEqual(expectedChange)
  },
)

it("separates raw Cell render values from the children function's defaultChildren", () => {
  vi.stubGlobal("PointerEvent", MouseEvent)
  const child = vi.fn((_state: CellRenderProps & { defaultChildren?: ReactNode }) => "Held content")
  const receiver = vi.fn<NonNullable<TCellProps["render"]>>((props, state) => (
    <td
      {...(props as ComponentPropsWithRef<"td">)}
      data-testid="rendered-cell"
      data-hovered={String(state.isHovered)}
    />
  ))
  const view = render(
    <Table
      aria-label="Cell source"
      selectionMode="multiple"
      selectionBehavior="replace"
      selectedKeys={new Set(["row"])}
    >
      <TableHeader columns={columns} />
      <TableBody>
        <Row id="row">
          <TableCell id="cell" render={receiver}>
            {child}
          </TableCell>
        </Row>
      </TableBody>
    </Table>,
  )
  const state = receiver.mock.calls.at(-1)![1]
  expect(state).toMatchObject({
    isSelected: true,
    isDisabled: false,
    isFocused: false,
    isFocusVisible: false,
    isHovered: false,
    columnIndex: 0,
    level: 1,
  })
  expect(Object.hasOwn(state, "defaultChildren")).toBe(false)
  expect(child.mock.calls.at(-1)![0]).toHaveProperty("defaultChildren", undefined)
  fireEvent(view.getByTestId("rendered-cell"), pointer("pointerover"))
  expect(view.getByTestId("rendered-cell")).toHaveAttribute("data-hovered", "true")
})

it("keeps the same canonical Cell and held editor when its native-element renderer is inserted and replaced", () => {
  const first: NonNullable<TCellProps["render"]> = (props) => (
    <td {...(props as ComponentPropsWithRef<"td">)} style={{ ...props.style, opacity: 0.8 }} />
  )
  const second: NonNullable<TCellProps["render"]> = (props) => (
    <td {...(props as ComponentPropsWithRef<"td">)} style={{ ...props.style, opacity: 0 }} />
  )
  const content = (renderer?: typeof first) => (
    <Table aria-label="Cell source">
      <TableHeader columns={columns} />
      <TableBody>
        <Row id="row">
          <TableCell data-testid="rendered-cell" render={renderer}>
            <input data-testid="cell-editor" value="" onChange={() => undefined} />
          </TableCell>
        </Row>
      </TableBody>
    </Table>
  )
  const view = render(content())
  const cell = view.getByTestId("rendered-cell"),
    input = view.getByTestId("cell-editor")
  view.rerender(content(first))
  expect(view.getByTestId("rendered-cell")).toBe(cell)
  expect(view.getByTestId("cell-editor")).toBe(input)
  view.rerender(content(second))
  expect(view.getByTestId("rendered-cell")).toBe(cell)
  expect(view.getByTestId("rendered-cell")).toHaveStyle({ opacity: 0 })
  expect(view.getByTestId("cell-editor")).toBe(input)
  expect(input).toHaveValue("")
})
