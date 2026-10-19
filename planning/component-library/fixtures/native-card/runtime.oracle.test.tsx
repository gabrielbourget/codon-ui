import { writeFileSync } from "node:fs"

import { act, render, screen, waitFor } from "@testing-library/react"
import {
  AnimatePresence,
  animationControls,
  MotionConfig,
  MotionContext,
  motion,
  motionValue,
  useAnimationControls,
} from "motion/react"
import { useContext, type ComponentProps } from "react"
import { afterAll, expect, it, vi } from "vitest"

import Card from "../../../../packages/react/src/components/Card/Card"

const records: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-card-runtime-oracle.json",
    JSON.stringify(
      { scope: "actual canonical component and pinned Motion DOM runtime; no native actions", records },
      null,
      2,
    ) + "\n",
  ),
)
const card = () => screen.getByTestId("card")

export const canonicalCardTypeBoundary = () => {
  const value = motionValue(0)
  // Card deliberately narrows the inherited MotionStyle to CSSProperties.
  // @ts-expect-error MotionValue is not part of Card's owned style type.
  const style = <Card style={{ opacity: value }} />
  // @ts-expect-error Card's owned children are ReactNode, not MotionValue.
  const children = <Card>{value}</Card>
  value.destroy()
  return [style, children]
}

it("forwards the actual root ref and React19 callback cleanup", () => {
  const retired = vi.fn(),
    ref = vi.fn(() => retired)
  const view = render(
    <Card ref={ref} data-testid="card">
      content
    </Card>,
  )
  expect(ref).toHaveBeenCalledWith(card())
  view.unmount()
  expect(retired).toHaveBeenCalledTimes(1)
  records.push({ case: "actual ref", cleanup: 1 })
})

it("initial=false starts at the actual animate target", () => {
  render(<Card data-testid="card" initial={false} animate={{ opacity: 0.35, x: 12 }} />)
  expect(card()).toHaveStyle({ opacity: "0.35", transform: "translateX(12px)" })
  records.push({ case: "initial false", opacity: card().style.opacity, transform: card().style.transform })
})

it("resolves a zero custom variant without a truthy fallback", () => {
  const visible = vi.fn((custom: number) => ({ opacity: custom }))
  render(<Card data-testid="card" initial={false} animate="visible" custom={0} variants={{ visible }} />)
  expect(visible).toHaveBeenCalled()
  expect(visible.mock.calls.every(([custom]) => custom === 0)).toBe(true)
  expect(card()).toHaveStyle({ opacity: "0" })
  records.push({ case: "custom variant", custom: 0, opacity: card().style.opacity })
})

it("requires controls to mount before set/start", () => {
  const controls = animationControls()
  expect(() => controls.set({ opacity: 0.2 })).toThrow(/mounted/)
  expect(() => controls.start({ opacity: 0.2 })).toThrow(/mounted/)
  records.push({ case: "unmounted controls", setRejected: true, startRejected: true })
})

it("set updates a subscribed Card and rejects requests after controller unmount", async () => {
  let controls!: ReturnType<typeof useAnimationControls>
  const started = vi.fn(),
    completed = vi.fn()
  const Owner = () => {
    controls = useAnimationControls()
    return <Card data-testid="card" animate={controls} onAnimationStart={started} onAnimationComplete={completed} />
  }
  const view = render(<Owner />)
  await act(() => controls.set({ opacity: 0.25 }))
  await waitFor(() => expect(card()).toHaveStyle({ opacity: "0.25" }))
  expect(started).not.toHaveBeenCalled()
  expect(completed).not.toHaveBeenCalled()
  view.unmount()
  expect(() => controls.set({ opacity: 1 })).toThrow(/mounted/)
  records.push({ case: "set and unmount", opacity: 0.25, animationCallbacks: 0, retiredSetRejected: true })
})

it("start resolves with original definition lifecycle callbacks", async () => {
  let controls!: ReturnType<typeof useAnimationControls>
  const started = vi.fn(),
    completed = vi.fn(),
    target = { opacity: 0.6 }
  const Owner = () => {
    controls = useAnimationControls()
    return <Card data-testid="card" animate={controls} onAnimationStart={started} onAnimationComplete={completed} />
  }
  render(
    <MotionConfig skipAnimations>
      <Owner />
    </MotionConfig>,
  )
  await act(async () => {
    await controls.start(target, { duration: 0 })
  })
  expect(started.mock.calls[0]).toEqual([target, undefined, undefined])
  expect(completed.mock.calls[0]).toEqual([target, undefined, undefined])
  expect(started.mock.calls[0][0]).toBe(target)
  expect(completed.mock.calls[0][0]).toBe(target)
  expect(card()).toHaveStyle({ opacity: "0.6" })
  records.push({
    case: "controls start",
    originalTargetIdentity: true,
    callbackArity: started.mock.calls[0].length,
    opacity: card().style.opacity,
  })
})

it("presence retains the actual exiting Card until completion", async () => {
  const complete = vi.fn()
  const node = (visible: boolean) => (
    <AnimatePresence onExitComplete={complete}>
      {visible ? (
        <Card
          key="card"
          data-testid="card"
          initial={false}
          style={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.05 }}
        />
      ) : null}
    </AnimatePresence>
  )
  const view = render(node(true)),
    element = card()
  await act(() => view.rerender(node(false)))
  expect(card()).toBe(element)
  await waitFor(() => expect(screen.queryByTestId("card")).toBeNull())
  expect(complete).toHaveBeenCalledTimes(1)
  records.push({ case: "presence", retainedOriginal: true, exitCompletions: 1 })
})

const inspect = (props: ComponentProps<typeof Card>) => {
  let current: ComponentProps<typeof Card>["layout"]
  const Reader = () => {
    current = useContext(MotionContext).visualElement?.getProps().layout
    return null
  }
  render(
    <Card {...props}>
      <Reader />
    </Card>,
  )
  return current
}
it("the wrapper overwrites inherited layout=true with omitted layoutMode", () => {
  expect(inspect({ layout: true })).toBeUndefined()
  records.push({ case: "inherited layout overwritten", effectiveLayout: null })
})
it("owned layoutMode overrides a conflicting inherited layout", () => {
  expect(inspect({ layout: "size", layoutMode: "position" })).toBe("position")
  records.push({ case: "owned layoutMode", effectiveLayout: "position" })
})

it("records that the typed public factory discards a supplied renderer override", () => {
  const renderer = vi.fn(() => {
    throw new Error("Supplied renderer invoked")
  })
  const Component = motion.create("div", {}, undefined, renderer)
  render(<Component data-testid="factory" initial={false} animate={{ opacity: 0.4 }} />)
  expect(screen.getByTestId("factory")).toHaveStyle({ opacity: "0.4" })
  expect(renderer).not.toHaveBeenCalled()
  records.push({
    case: "public renderer seam",
    typedFourthArgumentHonoured: false,
    suppliedRendererCalls: renderer.mock.calls.length,
    scope: "negative native-adapter feasibility observation",
  })
})
