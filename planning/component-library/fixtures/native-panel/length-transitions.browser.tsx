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
  let height: CSSProperties["height"],
    width: CSSProperties["width"],
    parentHeight = 180,
    changes = 0
  let original: Element | null = null,
    input: HTMLInputElement | null = null
  const results: unknown[] = []
  const render = () =>
    flushSync(() =>
      root.render(
        <MotionConfig reducedMotion="always">
          <Panel
            isOpen
            isDismissable={false}
            height={height}
            width={width}
            customOverlayStyles={{
              left: 40,
              top: 30,
              right: "auto",
              bottom: "auto",
              width: 240,
              height: parentHeight,
              padding: 10,
              border: "4px solid black",
              boxSizing: "border-box",
              transform: "translateX(0)",
              overflow: "visible",
            }}
          >
            <input ref={editor} value="" onChange={() => changes++} />
          </Panel>
        </MotionConfig>,
      ),
    )
  const panel = () => document.querySelector(`.${styles.panel}`)!
  const sample = () => {
    const node = panel(),
      box = node.getBoundingClientRect(),
      computed = getComputedStyle(node)
    return {
      width: box.width,
      height: box.height,
      computedWidth: computed.width,
      computedHeight: computed.height,
      samePanel: node === original,
      sameEditor: editor.current === input,
      value: editor.current?.value,
      changes,
    }
  }
  const transition = (property: string) =>
    panel()
      .getAnimations()
      .find(
        (animation): animation is CSSTransition =>
          animation instanceof CSSTransition && animation.transitionProperty === property,
      )
  const trace = async (id: string, property: "height" | "width", change: () => void, resize = false) => {
    results.push({ id, phase: "before", ...sample() })
    change()
    render()
    panel().getBoundingClientRect()
    await frame()
    const animation = transition(property)
    if (!animation) throw new Error(`Actual canonical ${id} did not create its ${property} CSS transition`)
    animation.pause()
    const keyframes = (animation.effect as KeyframeEffect).getKeyframes()
    for (const time of [0, 87.5, 175, 262.5, 350]) {
      animation.currentTime = time
      await frame()
      results.push({ id, phase: "sample", time, timing: animation.effect?.getTiming(), keyframes, ...sample() })
      if (resize && time === 175) {
        parentHeight = 260
        render()
        panel().getBoundingClientRect()
        await frame()
        results.push({
          id,
          phase: "parent-resize",
          time,
          sameTransition: transition(property) === animation,
          ...sample(),
        })
      }
    }
    animation.finish()
    await frame()
    results.push({ id, phase: "complete", ...sample() })
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
    original = panel()
    input = editor.current
    await trace(
      "viewport-height-to-authored-percent",
      "height",
      () => {
        height = "100%"
      },
      true,
    )
    await trace("authored-percent-to-viewport-height", "height", () => {
      height = undefined
    })
    await trace("default-width-to-authored-percent", "width", () => {
      width = "50%"
    })
    await trace("authored-percent-to-number", "width", () => {
      width = 80
    })
  } catch (error) {
    results.push({ failure: error instanceof Error ? error.message : String(error) })
  }
  const result = { source, viewport: { width: innerWidth, height: innerHeight }, results }
  document.getElementById("results")!.textContent = JSON.stringify(result, null, 2)
  await fetch("/result", { method: "POST", body: JSON.stringify(result) })
}
void run()
