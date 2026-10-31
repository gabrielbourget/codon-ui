import { writeFileSync } from "node:fs"

import { act, render } from "@testing-library/react"
import { motion, motionValue } from "motion/react"
import { afterAll, expect, it, vi } from "vitest"

const records: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-card-owner-oracle.json",
    JSON.stringify({ scope: "Actual pinned React renderer initialization only; no native actions", records }, null, 2) +
      "\n",
  ),
)

it("records initial resolver custom zero and empty pre-render value/velocity maps", () => {
  const resolver = vi.fn((custom: number) => ({ x: custom, opacity: [1, 0] }))
  const view = render(
    <motion.div
      data-testid="root"
      initial={["first", "second"]}
      custom={0}
      variants={{ first: { x: 10 }, second: resolver }}
    />,
  )
  expect(resolver.mock.calls[0]).toEqual([0, {}, {}])
  expect(view.getByTestId("root").style.opacity).toBe("1")
  records.push({
    case: "initial resolver",
    args: resolver.mock.calls[0],
    opacity: view.getByTestId("root").style.opacity,
  })
})

it("records blocked initial endpoints and transition-end initialization", () => {
  const view = render(
    <motion.div data-testid="root" initial={false} animate={{ x: [0, 100], transitionEnd: { opacity: 0 } }} />,
  )
  expect(view.getByTestId("root").style.transform).toContain("100px")
  expect(view.getByTestId("root").style.opacity).toBe("0")
  records.push({
    case: "blocked initial",
    transform: view.getByTestId("root").style.transform,
    opacity: view.getByTestId("root").style.opacity,
  })
})

it("records explicit initial requests updating a supplied value on real renderer replacement", () => {
  const value = motionValue(3)
  const view = render(<motion.div key="first" initial={{ x: 0 }} style={{ x: value }} />)
  expect(value.get()).toBe(0)
  act(() => value.set(7))
  view.rerender(<motion.div key="next" initial={{ x: 0 }} style={{ x: value }} />)
  expect(value.get()).toBe(0)
  records.push({
    case: "explicit initial value request",
    initial: 3,
    requestedInitial: 0,
    replacementInitial: value.get(),
    sameCallerValue: true,
  })
  view.unmount()
  value.destroy()
})
