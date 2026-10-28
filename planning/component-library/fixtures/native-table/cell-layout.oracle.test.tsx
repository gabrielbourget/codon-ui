import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { cleanup, render, screen } from "@testing-library/react"
import React, { createRef } from "react"
import { Column, Row, TableBody, TableHeader } from "react-aria-components"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import Table from "../../../../packages/react/src/components/Table/Table"
import TableCell from "../../../../packages/react/src/components/Table/components/TableCell/TableCell"
import styles from "../../../../packages/react/src/components/Table/components/TableCell/TableCellStyles.module.css"
import type { TCellProps } from "../../../../packages/react/src/components/Table/components/TableCell/helpers"

let sheet: HTMLStyleElement
const stylesheetPath = [
  resolve(process.cwd(), "packages/react/src/components/Table/components/TableCell/TableCellStyles.module.css"),
  resolve(process.cwd(), "src/components/Table/components/TableCell/TableCellStyles.module.css"),
].find(existsSync)
beforeEach(() => {
  sheet = document.createElement("style")
  const cssSource = readFileSync(stylesheetPath!, "utf8")
  sheet.textContent = cssSource.replace(/\.([A-Za-z][\w-]*)/g, (selector, name) =>
    styles[name] ? `.${styles[name]}` : selector,
  )
  document.head.append(sheet)
})
afterEach(() => {
  cleanup()
  sheet.remove()
})
const tree = (props: TCellProps = {}) => (
  <Table aria-label="Cell layout">
    <TableHeader>
      <Column id="value" isRowHeader>
        Value
      </Column>
    </TableHeader>
    <TableBody>
      <Row id="row">
        <TableCell data-testid="cell" {...props}>
          {props.children ?? "Long content"}
        </TableCell>
      </Row>
    </TableBody>
  </Table>
)

it.each([undefined, false, true])("owns truncate %s in CSS without leaking a host attribute", (truncate) => {
  render(tree({ truncate }))
  const cell = screen.getByTestId("cell")
  expect(cell.classList.contains(styles["tableCell--truncate"])).toBe(!!truncate)
  expect(getComputedStyle(cell).overflow).toBe(truncate ? "hidden" : "visible")
  expect(getComputedStyle(cell).whiteSpace).toBe(truncate ? "nowrap" : "normal")
  expect(cell.hasAttribute("truncate")).toBe(false)
})
it.each([undefined, 0, 2, 3])("owns the optional maxLines %s wrapper", (maxLines) => {
  render(tree({ maxLines }))
  const cell = screen.getByTestId("cell")
  const clamp = cell.querySelector(`.${styles.tableCell__clamp}`) as HTMLElement | null
  expect(!!clamp).toBe(!!maxLines)
  if (maxLines) expect(clamp!.style.webkitLineClamp).toBe(String(maxLines))
  expect(cell.hasAttribute("maxLines")).toBe(false)
})
it("retains raw render values, original cell ref and final authored overflow", () => {
  const ref = createRef<HTMLTableCellElement | HTMLDivElement>()
  const children = vi.fn((_values: { defaultChildren: unknown }) => <span>Authored cell text</span>)
  const view = render(
    tree({
      ref,
      truncate: true,
      maxLines: 2,
      children,
      customStyles: { overflow: "hidden" },
      style: { overflow: "visible", padding: 0 },
    }),
  )
  const cell = ref.current
  expect(children.mock.calls.at(-1)![0]).toHaveProperty("defaultChildren", undefined)
  expect(getComputedStyle(screen.getByTestId("cell")).overflow).toBe("visible")
  expect(screen.getByTestId("cell").style.padding).toBe("0px")
  view.rerender(tree({ ref, maxLines: 3, children }))
  expect(ref.current).toBe(cell)
})
