import { writeFileSync } from "node:fs"

import { act, cleanup, render } from "@testing-library/react"
import { createRef } from "react"
import { useOverlayPosition } from "react-aria/useOverlayPosition"
import { afterAll, afterEach, expect, it } from "vitest"

const cases = Array.from({ length: 24 }, (_, index) => {
  const top = index % 3 === 0 ? 20 : index % 3 === 1 ? 50 : 70
  const height = index % 4 === 0 ? 0 : index % 4 === 1 ? 80 : index % 4 === 2 ? 140 : 60
  const origin = index % 2 === 0 ? 0 : 200
  return {
    name: `source-${index + 1}`,
    beforeTop: origin + top,
    beforeBottom: origin + top + 20,
    beforeViewportTop: origin,
    beforeViewportBottom: origin + 100,
    afterTop: origin + top + 30,
    afterBottom: origin + top + 50,
    afterViewportTop: origin + 30,
    afterViewportBottom: origin + 30 + height,
    current: index % 5 === 0 ? 95 : 50,
    minimum: 0,
    maximum: 100,
  }
})
const observed: Array<(typeof cases)[number] & { expected: number }> = []
afterEach(cleanup)
afterAll(() => {
  expect(observed).toHaveLength(24)
  expect(new Set(observed.map(({ expected }) => expected)).size).toBeGreaterThanOrEqual(4)
  writeFileSync("/private/tmp/codon-native-click-popover-scroll-oracle.json", JSON.stringify(observed, null, 2) + "\n")
})
const rect = (top: number, bottom: number) => ({
  x: 0,
  y: top,
  top,
  bottom,
  left: 0,
  right: 100,
  width: 100,
  height: bottom - top,
  toJSON: () => ({}),
})

it.each(cases)("executes pinned useOverlayPosition scroll anchoring: $name", async (scenario) => {
  const target = createRef<HTMLButtonElement>(),
    overlay = createRef<HTMLDivElement>(),
    scroll = createRef<HTMLDivElement>(),
    focus = createRef<HTMLInputElement>()
  let position: ReturnType<typeof useOverlayPosition>
  const Probe = () => {
    position = useOverlayPosition({
      targetRef: target,
      overlayRef: overlay,
      scrollRef: scroll,
      placement: "bottom",
      isOpen: true,
    })
    return (
      <>
        <button ref={target}>Anchor</button>
        <div ref={overlay}>
          <div ref={scroll}>
            <input ref={focus} aria-label="Actual source focus" />
          </div>
        </div>
      </>
    )
  }
  await act(() => {
    render(<Probe />)
  })
  let after = false,
    offset = scenario.current
  Object.defineProperty(scroll.current, "scrollTop", {
    configurable: true,
    get: () => offset,
    set: (value: number) => {
      offset = Math.max(scenario.minimum, Math.min(scenario.maximum, value))
    },
  })
  Object.defineProperty(scroll.current, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      after
        ? rect(scenario.afterViewportTop, scenario.afterViewportBottom)
        : rect(scenario.beforeViewportTop, scenario.beforeViewportBottom),
  })
  Object.defineProperty(focus.current, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      after
        ? rect(scenario.afterTop - offset + scenario.current, scenario.afterBottom - offset + scenario.current)
        : rect(scenario.beforeTop, scenario.beforeBottom),
  })
  Object.defineProperty(overlay.current, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ ...rect(50, 150), x: 100, left: 100, right: 200 }),
  })
  Object.defineProperty(target.current, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ ...rect(20, 40), x: 100, left: 100, right: 200 }),
  })
  for (const [node, width, height] of [
    [overlay.current, 100, 100],
    [target.current, 100, 20],
    [document.body, 400, 400],
    [document.documentElement, 400, 400],
  ] as const) {
    for (const [name, value] of Object.entries({
      offsetWidth: width,
      offsetHeight: height,
      clientWidth: width,
      clientHeight: height,
      scrollWidth: width,
      scrollHeight: height,
    }))
      Object.defineProperty(node, name, { configurable: true, value })
  }
  let top = overlay.current!.style.top
  Object.defineProperty(overlay.current!.style, "top", {
    configurable: true,
    get: () => top,
    set: (value: string) => {
      top = value
      if (value === "0px") after = true
    },
  })
  await act(() => focus.current!.focus())
  expect(document.activeElement).toBe(focus.current)
  await act(() => position!.updatePosition())
  expect(after).toBe(true)
  expect(Number.isFinite(offset)).toBe(true)
  observed.push({ ...scenario, expected: offset })
})
