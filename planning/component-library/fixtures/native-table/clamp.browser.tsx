import { createRef, type CSSProperties, type ReactNode } from "react"
import { Column, Row, TableBody, TableHeader } from "react-aria-components"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import TableCell from "../../../../packages/react/src/components/Table/components/TableCell/TableCell"
import styles from "../../../../packages/react/src/components/Table/components/TableCell/TableCellStyles.module.css"
import Table from "../../../../packages/react/src/components/Table/Table"
import "../../../../packages/react/theme.css"

const paragraph = "Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa."
type TCase = {
  id: string
  kind: "raw" | "inline" | "blocks" | "widget" | "editor" | "breaks"
  maxLines?: number
  truncate?: boolean
  style?: CSSProperties
}
const cases: TCase[] = [
  { id: "raw-unclamped", kind: "raw" },
  { id: "raw-one", kind: "raw", maxLines: 1 },
  { id: "raw-two", kind: "raw", maxLines: 2 },
  { id: "raw-three", kind: "raw", maxLines: 3 },
  { id: "inline-two", kind: "inline", maxLines: 2 },
  { id: "blocks-two", kind: "blocks", maxLines: 2 },
  { id: "widget-two", kind: "widget", maxLines: 2 },
  { id: "breaks-two", kind: "breaks", maxLines: 2 },
  { id: "truncate-raw", kind: "raw", truncate: true },
  { id: "truncate-with-clamp", kind: "raw", truncate: true, maxLines: 2 },
  { id: "authored-visible", kind: "raw", truncate: true, maxLines: 2, style: { overflow: "visible" } },
  { id: "zero-limit", kind: "raw", maxLines: 0 },
  { id: "negative-limit", kind: "raw", maxLines: -1 },
  { id: "fractional-limit", kind: "raw", maxLines: 1.5 },
  { id: "rtl-two", kind: "raw", maxLines: 2, style: { direction: "rtl" } },
  { id: "editor-two", kind: "editor", maxLines: 2 },
  { id: "editor-three", kind: "editor", maxLines: 3 },
  { id: "editor-without-wrapper", kind: "editor" },
]
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const rect = (element: Element) => {
  const box = element.getBoundingClientRect()
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}
const computed = (element: Element) => {
  const value = getComputedStyle(element)
  return Object.fromEntries(
    ["display", "overflow", "whiteSpace", "textOverflow", "webkitLineClamp", "lineHeight", "direction"].map((key) => [
      key,
      value[key as keyof CSSStyleDeclaration],
    ]),
  )
}
const run = async () => {
  const source = await fetch("/source.json").then((response) => response.json())
  const root = createRoot(document.getElementById("root")!)
  const editor = createRef<HTMLInputElement>()
  const original = createRef<HTMLTableCellElement | HTMLDivElement>()
  const results: unknown[] = []
  let changes = 0
  let originalCell: Element | null = null
  let previousEditor: HTMLInputElement | null = null
  const content = (kind: TCase["kind"]): ReactNode => {
    if (kind === "raw") return paragraph
    if (kind === "inline")
      return (
        <>
          <span>{paragraph.slice(0, 40)}</span>
          <strong>{paragraph.slice(40)}</strong>
        </>
      )
    if (kind === "blocks")
      return (
        <>
          <div>{paragraph}</div>
          <div>{paragraph}</div>
        </>
      )
    if (kind === "widget")
      return (
        <>
          <span>{paragraph.slice(0, 30)}</span>
          <div style={{ height: 50, width: 80, background: "teal" }}>Widget</div>
          <span>{paragraph}</span>
        </>
      )
    if (kind === "breaks")
      return (
        <>
          First
          <br />
          Second
          <br />
          Third
          <br />
          Fourth
        </>
      )
    return (
      <>
        <span>{paragraph}</span>
        <input ref={editor} value="held original value" onChange={() => changes++} />
        <span>{paragraph}</span>
      </>
    )
  }
  try {
    for (const value of cases) {
      flushSync(() =>
        root.render(
          <Table aria-label="Canonical mixed-content clamp" customStyles={{ width: 180 }}>
            <TableHeader>
              <Column id="value" isRowHeader>
                Value
              </Column>
            </TableHeader>
            <TableBody>
              <Row id="row">
                <TableCell
                  ref={original}
                  data-testid="clamp-cell"
                  maxLines={value.maxLines}
                  truncate={value.truncate}
                  customStyles={{
                    width: 180,
                    maxWidth: 180,
                    fontFamily: "monospace",
                    fontSize: 16,
                    lineHeight: "24px",
                    padding: 0,
                  }}
                  style={value.style}
                >
                  {content(value.kind)}
                </TableCell>
              </Row>
            </TableBody>
          </Table>,
        ),
      )
      await frame()
      await frame()
      const cell = original.current
      if (!cell || !cell.matches('[data-testid="clamp-cell"]'))
        throw new Error("Actual original canonical Cell ref is required")
      originalCell ??= cell
      const clamp = cell.querySelector(`.${styles.tableCell__clamp}`)
      if (!!clamp !== !!value.maxLines) throw new Error("Canonical wrapper presence changed")
      const range = document.createRange()
      range.selectNodeContents(clamp ?? cell)
      const sample = () => ({
        cell: rect(cell),
        cellStyle: computed(cell),
        clamp: clamp && rect(clamp),
        clampStyle: clamp && computed(clamp),
        scroll: clamp && { top: clamp.scrollTop, height: clamp.scrollHeight, client: clamp.clientHeight },
        input: editor.current && rect(editor.current),
        inputFocused: editor.current !== null && document.activeElement === editor.current,
      })
      const before = sample()
      const sameEditor = !!editor.current && editor.current === previousEditor
      if (editor.current) {
        editor.current.focus()
        await frame()
        await frame()
      }
      results.push({
        case: value,
        before,
        afterFocus: sample(),
        contentFragments: Array.from(range.getClientRects(), (box) => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        })),
        sameCell: cell === originalCell,
        sameEditor,
        value: editor.current?.value,
        changes,
      })
      previousEditor = editor.current
    }
    const result = {
      source,
      userAgent: navigator.userAgent,
      results,
      scope: "Canonical browser layout/ref/focus observation only; no native qualification",
    }
    document.getElementById("results")!.textContent = JSON.stringify(result, null, 2)
    const response = await fetch("/result", { method: "POST", body: JSON.stringify(result) })
    if (!response.ok) throw new Error("Canonical result custody refused")
    document.body.dataset.status = "passed"
  } catch (error) {
    document.getElementById("results")!.textContent = JSON.stringify({ source, error: String(error), results }, null, 2)
    document.body.dataset.status = "failed"
  }
}
void run()
