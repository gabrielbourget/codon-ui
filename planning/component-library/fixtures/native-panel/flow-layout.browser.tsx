import { MotionConfig } from "motion/react"
import { createRef, type CSSProperties } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import Panel from "../../../../packages/react/src/components/Panel/Panel"
import styles from "../../../../packages/react/src/components/Panel/PanelStyles.module.css"

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const run = async () => {
  const source = await fetch("/source.json").then((response) => response.json())
  const root = createRoot(document.getElementById("root")!)
  const editor = createRef<HTMLInputElement>()
  let changes = 0
  let originalPanel: Element | null = null,
    originalEditor: HTMLInputElement | null = null
  let body: CSSProperties = { position: "relative", width: 80, height: 60, boxSizing: "border-box" }
  let overlay: CSSProperties = {
    left: 40,
    top: 30,
    right: "auto",
    bottom: "auto",
    width: 240,
    height: 180,
    padding: 10,
    border: "4px solid black",
    boxSizing: "border-box",
    overflow: "visible",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  }
  const render = () =>
    flushSync(() =>
      root.render(
        <MotionConfig reducedMotion="always">
          <Panel isOpen isDismissable={false} customStyles={body} customOverlayStyles={overlay}>
            <input
              ref={editor}
              value=""
              onChange={() => changes++}
              style={{ width: 80, height: 40, padding: 0, border: 0, boxSizing: "border-box" }}
            />
          </Panel>
        </MotionConfig>,
      ),
    )
  const panel = () => document.querySelector(`.${styles.panel}`)!
  const parent = () => document.querySelector(`.${styles.panel__overlay}`)!
  const rect = (element: Element) => {
    const box = element.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }
  const results: unknown[] = []
  const sample = (id: string, phase: string, time?: number) =>
    results.push({
      id,
      phase,
      time,
      panel: rect(panel()),
      overlay: rect(parent()),
      input: rect(editor.current!),
      display: getComputedStyle(parent()).display,
      flexBasis: getComputedStyle(panel()).flexBasis,
      samePanel: panel() === originalPanel,
      sameEditor: editor.current === originalEditor,
      value: editor.current?.value,
      changes,
    })
  const settle = async (nextBody: CSSProperties, nextOverlay: CSSProperties) => {
    body = { ...nextBody, transition: "none" }
    overlay = nextOverlay
    render()
    panel().getBoundingClientRect()
    await frame()
    body = nextBody
    render()
    panel().getBoundingClientRect()
    await frame()
  }
  const trace = async (id: string, property: "height" | "width", value: string) => {
    sample(id, "before")
    body = { ...body, [property]: value }
    render()
    panel().getBoundingClientRect()
    await frame()
    const animation = panel()
      .getAnimations()
      .find((entry): entry is CSSTransition => entry instanceof CSSTransition && entry.transitionProperty === property)
    if (!animation) throw new Error(`Missing original canonical ${id} transition`)
    animation.pause()
    for (const time of [0, 175, 350]) {
      animation.currentTime = time
      await frame()
      sample(id, "sample", time)
    }
    animation.finish()
    await frame()
    sample(id, "complete")
  }
  try {
    render()
    await frame()
    await frame()
    const started = performance.now()
    while (!["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(panel()).transform)) {
      if (performance.now() - started > 1000)
        throw new Error("Original250ms Panel presence did not settle within1000ms")
      await frame()
    }
    originalPanel = panel()
    originalEditor = editor.current
    const sized = { ...body, flexBasis: 140, flexGrow: 1, flexShrink: 1, alignSelf: "center" } as const
    const bounded = { ...overlay }
    await settle(sized, bounded)
    sample("block-ignores-flex", "settled")
    await settle(sized, { ...bounded, display: "flex" })
    sample("explicit-flex", "settled")
    await settle(sized, bounded)
    sample("restore-block", "settled")
    const normal = { position: "relative", width: 80, height: 80, boxSizing: "border-box" } as const
    await settle(normal, { ...bounded, height: "auto" })
    await trace("auto-parent-height-percent", "height", "100%")
    await settle(normal, { ...bounded, height: "auto", minHeight: 200 })
    await trace("min-parent-height-percent", "height", "100%")
    await settle({ ...normal, height: 40 }, { ...bounded, width: "auto", height: "auto" })
    await trace("auto-parent-width-percent", "width", "50%")
  } catch (error) {
    results.push({ failure: error instanceof Error ? error.message : String(error) })
  }
  const result = { source, viewport: { width: innerWidth, height: innerHeight }, results }
  document.getElementById("results")!.textContent = JSON.stringify(result, null, 2)
  await fetch("/result", { method: "POST", body: JSON.stringify(result) })
}
void run()
