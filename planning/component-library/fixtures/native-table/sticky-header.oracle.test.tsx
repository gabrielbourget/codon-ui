import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { cleanup, render, screen } from "@testing-library/react"
import type { CSSProperties } from "react"
import { Cell, Column, Row, TableBody, TableHeader } from "react-aria-components"
import { afterEach, beforeEach, expect, it } from "vitest"

import Table from "../../../../packages/react/src/components/Table/Table"
import styles from "../../../../packages/react/src/components/Table/TableStyles.module.css"

let sheet: HTMLStyleElement
const path = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/react/src/components/Table/TableStyles.module.css",
)
beforeEach(() => {
  sheet = document.createElement("style")
  sheet.textContent = readFileSync(path, "utf8").replace(/\.([A-Za-z][\w-]*)/g, (selector, name) =>
    styles[name] ? `.${styles[name]}` : selector,
  )
  document.head.append(sheet)
})
afterEach(() => {
  cleanup()
  sheet.remove()
})
const tree = (stickyHeader?: boolean, headerStyle?: CSSProperties) => (
  <Table aria-label="Sticky table" stickyHeader={stickyHeader}>
    <TableHeader>
      <Column id="name" isRowHeader style={headerStyle}>
        Name
      </Column>
    </TableHeader>
    <TableBody>
      <Row id="one">
        <Cell>First</Cell>
      </Row>
    </TableBody>
  </Table>
)

it.each([undefined, false, true])(
  "owns stickyHeader %s through CSS without changing the actual column host",
  (sticky) => {
    const view = render(tree(sticky))
    const table = screen.getByRole("grid")
    const column = screen.getByRole("columnheader")
    expect(table.classList.contains(styles["table--stickyHeader"])).toBe(!!sticky)
    expect(getComputedStyle(column).position).toBe(sticky ? "sticky" : "")
    expect(table).not.toHaveAttribute("stickyHeader")
    view.rerender(tree(!sticky))
    expect(screen.getByRole("columnheader")).toBe(column)
  },
)

it("retains the exact top/background fallback chain and z-index on both header selectors", () => {
  const rule = [...sheet.sheet!.cssRules].find((item) =>
    (item as CSSStyleRule).selectorText?.includes('[role="columnheader"]'),
  ) as CSSStyleRule
  expect(rule.selectorText).toContain("thead th")
  expect(rule.style.getPropertyValue("top")).toBe(
    "var(--cui-table-sticky-header-offset, var(--tableStickyHeaderOffset, 0))",
  )
  expect(rule.style.getPropertyValue("background").replace(/\s+/g, " ")).toBe(
    "var( --cui-table-sticky-header-background, var(--tableStickyHeaderBackground, var(--cui-background, #fff)) )",
  )
  expect(rule.style.getPropertyValue("z-index")).toBe("3")
})

it("keeps final authored position, zero top, background and stacking precedence", () => {
  render(tree(true, { position: "relative", top: 0, background: "blue", zIndex: 0 }))
  const column = screen.getByRole("columnheader")
  expect(getComputedStyle(column).position).toBe("relative")
  expect(getComputedStyle(column).top).toBe("0px")
  expect(getComputedStyle(column).backgroundColor).toBe("rgb(0, 0, 255)")
  expect(getComputedStyle(column).zIndex).toBe("0")
})
