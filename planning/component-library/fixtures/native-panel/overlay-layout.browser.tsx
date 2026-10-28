import { MotionConfig } from "motion/react"
import { createRef, type CSSProperties } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import Panel from "../../../../packages/react/src/components/Panel/Panel"
import styles from "../../../../packages/react/src/components/Panel/PanelStyles.module.css"

const bounded: CSSProperties = {
  left: 40,
  top: 30,
  right: "auto",
  bottom: "auto",
  width: 240,
  height: 180,
  padding: 10,
  border: "4px solid black",
  boxSizing: "border-box",
  overflow: "hidden",
}
const cases: { id: string; overlay?: CSSProperties; panel?: CSSProperties; blur?: boolean }[] = [
  { id: "bounded-fixed", overlay: bounded },
  { id: "bounded-transform", overlay: { ...bounded, transform: "translateX(0)" } },
  { id: "bounded-filter", overlay: { ...bounded, filter: "brightness(1)" } },
  { id: "bounded-backdrop-filter", overlay: bounded, blur: true },
  { id: "bounded-opacity", overlay: { ...bounded, opacity: 0.5 } },
  { id: "bounded-isolation", overlay: { ...bounded, isolation: "isolate" } },
  { id: "bounded-blend", overlay: { ...bounded, mixBlendMode: "multiply" } },
  { id: "relative-overlay", overlay: { ...bounded, position: "relative" } },
  { id: "authored-absolute-panel", overlay: bounded, panel: { position: "absolute" } },
  { id: "authored-relative-panel", overlay: bounded, panel: { position: "relative" } },
  { id: "hidden-overlay", overlay: { ...bounded, display: "none" } },
  { id: "contents-overlay", overlay: { ...bounded, display: "contents", opacity: 0.5 } },
  { id: "negative-panel-order", overlay: bounded, panel: { zIndex: -1 } },
  { id: "transparent-overlay-input", overlay: { opacity: 0 } },
  { id: "reset-overlay" },
]
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const settlePresence = async (element: Element) => {
  const started = performance.now()
  while (!["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(element).transform)) {
    if (performance.now() - started > 1000)
      throw new Error("Canonical Panel's250ms presence transform did not settle within1000ms")
    await frame()
  }
}
const rect = (element: Element) => {
  const box = element.getBoundingClientRect()
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}
const computed = (element: Element) => {
  const style = getComputedStyle(element)
  return Object.fromEntries(
    [
      "position",
      "display",
      "width",
      "height",
      "boxSizing",
      "left",
      "top",
      "right",
      "bottom",
      "paddingLeft",
      "paddingTop",
      "borderLeftWidth",
      "borderTopWidth",
      "overflow",
      "opacity",
      "transform",
      "filter",
      "backdropFilter",
      "isolation",
      "mixBlendMode",
      "zIndex",
    ].map((field) => [field, style[field as keyof CSSStyleDeclaration]]),
  )
}
const run = async () => {
  const source = await fetch("/source.json").then((response) => response.json())
  const results: unknown[] = []
  const root = createRoot(document.getElementById("root")!)
  const editor = createRef<HTMLInputElement>()
  let originalPanel: Element | null = null,
    originalEditor: HTMLInputElement | null = null,
    changes = 0
  try {
    for (const sample of cases) {
      flushSync(() =>
        root.render(
          <MotionConfig reducedMotion="always">
            <Panel
              isOpen
              isDismissable={false}
              width="50%"
              height={80}
              overlayBlur={sample.blur}
              customOverlayStyles={sample.overlay}
              style={{ boxSizing: "border-box", transition: "none", backgroundColor: "red", ...sample.panel }}
            >
              <input
                ref={editor}
                aria-label="Retained overlay editor"
                value=""
                onChange={() => {
                  changes++
                }}
                style={{ width: 30, height: 20 }}
              />
            </Panel>
          </MotionConfig>,
        ),
      )
      for (let count = 0; count < 4; count++) await frame()
      const panel = document.querySelector("[data-testid=panel]")!
      await settlePresence(panel)
      const overlay = panel.closest(`.${styles["panel__overlay"]}`)!
      originalPanel ??= panel
      originalEditor ??= editor.current
      if (panel !== originalPanel || editor.current !== originalEditor || changes || editor.current?.value !== "")
        throw new Error(`Original Panel/editor ownership changed at ${sample.id}`)
      const hit = (x: number, y: number) => {
        const element = document.elementFromPoint(x, y)
        return {
          x,
          y,
          tag: element?.tagName ?? null,
          panel: !!element && (element === panel || panel.contains(element)),
          overlay: !!element && (element === overlay || overlay.contains(element)),
        }
      }
      results.push({
        id: sample.id,
        input: sample,
        panel: { rect: rect(panel), style: computed(panel) },
        overlay: { rect: rect(overlay), style: computed(overlay) },
        hits: [hit(10, 10), hit(60, 60)],
        originalPanel: true,
        originalEditor: true,
        value: editor.current?.value,
        changes,
      })
    }
    const result = {
      source,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      profile:
        "Actual canonical Panel; consumer MotionConfig reducedMotion=always and authored transition=none; layout/hit controls only",
      results,
    }
    document.getElementById("results")!.textContent = JSON.stringify(result, null, 2)
    const response = await fetch("/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    })
    document.body.dataset.receipt = String(response.status)
  } catch (error) {
    const failure = { source, failure: error instanceof Error ? error.stack : String(error), results }
    document.getElementById("results")!.textContent = JSON.stringify(failure, null, 2)
    await fetch("/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(failure),
    })
    throw error
  }
}
void run()
