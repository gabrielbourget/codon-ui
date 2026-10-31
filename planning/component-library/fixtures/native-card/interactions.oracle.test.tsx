import { writeFileSync } from "node:fs"

import { fireEvent, render } from "@testing-library/react"
import { MotionConfig, motion } from "motion/react"
import { afterAll, expect, it, vi } from "vitest"

const records: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-card-interaction-oracle.json",
    JSON.stringify(
      {
        scope:
          "Actual pinned React gesture source with explicit DOM pointer-event models; no native pointer/window/rendering proof",
        records,
      },
      null,
      2,
    ) + "\n",
  ),
)
const pointer = (
  type: string,
  clientX = 20,
  extra: { pointerType?: string; isPrimary?: boolean; button?: number } = {},
) => {
  const original = new MouseEvent(type, { bubbles: true, clientX, clientY: 30, button: extra.button ?? 0 })
  Object.defineProperties(original, {
    pointerType: { value: extra.pointerType ?? "mouse" },
    isPrimary: { value: extra.isPrimary ?? true },
  })
  return original
}

it("preserves pointer event identity and defers tap callbacks after dispatch", async () => {
  const start = vi.fn(),
    tap = vi.fn(),
    cancel = vi.fn()
  const view = render(<motion.div data-testid="root" onTapStart={start} onTap={tap} onTapCancel={cancel} />)
  const root = view.getByTestId("root"),
    down = pointer("pointerdown"),
    up = pointer("pointerup", 70)
  expect(root.tabIndex).toBe(0)
  fireEvent(root, down)
  fireEvent(root, up)
  expect(start).not.toHaveBeenCalled()
  expect(tap).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(tap).toHaveBeenCalledTimes(1))
  expect(start.mock.calls[0][0]).toBe(down)
  expect(tap.mock.calls[0][0]).toBe(up)
  expect(start.mock.calls[0][1]).toEqual({ point: { x: 20, y: 30 } })
  expect(tap.mock.calls[0][1]).toEqual({ point: { x: 70, y: 30 } })
  expect(cancel).not.toHaveBeenCalled()
  records.push({
    case: "tap original event/postRender/native mapping baseline",
    downPoint: start.mock.calls[0][1],
    upPoint: tap.mock.calls[0][1],
    originalEvents: true,
    defaultTabIndex: root.tabIndex,
  })
})

it("defers pressed hover leave until release and resets that deferral on reentry", async () => {
  const start = vi.fn(),
    end = vi.fn()
  const view = render(<motion.div data-testid="root" onHoverStart={start} onHoverEnd={end} />)
  const root = view.getByTestId("root")
  fireEvent(root, pointer("pointerenter"))
  fireEvent(root, pointer("pointerdown"))
  fireEvent(root, pointer("pointerleave", 90))
  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1))
  expect(end).not.toHaveBeenCalled()
  fireEvent(root, pointer("pointerenter", 25))
  fireEvent(root, pointer("pointerup", 25))
  await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  expect(end).not.toHaveBeenCalled()
  fireEvent(root, pointer("pointerdown", 25))
  fireEvent(root, pointer("pointerleave", 90))
  const released = pointer("pointerup", 100)
  fireEvent(window, released)
  await vi.waitFor(() => expect(end).toHaveBeenCalledTimes(1))
  expect(end.mock.calls[0][0]).toBe(released)
  expect(end.mock.calls[0][1]).toEqual({ point: { x: 100, y: 30 } })
  records.push({
    case: "held hover leave/reentry/release",
    starts: start.mock.calls.length,
    ends: end.mock.calls.length,
    originalReleaseEvent: true,
    endPoint: end.mock.calls[0][1],
  })
})

it("filters touch hover and secondary mouse press at the actual pinned source boundary", async () => {
  const start = vi.fn(),
    hoverStart = vi.fn()
  const view = render(<motion.div data-testid="root" onTapStart={start} onHoverStart={hoverStart} />)
  const root = view.getByTestId("root")
  fireEvent(root, pointer("pointerenter", 20, { pointerType: "touch" }))
  fireEvent(root, pointer("pointerdown", 20, { button: 2 }))
  fireEvent(window, pointer("pointerup", 20, { button: 2 }))
  fireEvent(root, pointer("pointerenter"))
  await vi.waitFor(() => expect(hoverStart).toHaveBeenCalledTimes(1))
  expect(start).not.toHaveBeenCalled()
  records.push({
    case: "touch hover/secondary mouse filter",
    tapStarts: start.mock.calls.length,
    hoverStarts: hoverStart.mock.calls.length,
    nativePrimaryPointerFidelity: "OPEN",
  })
})

it.each([undefined, true, false])(
  "retains nested tap delivery for propagate.tap=%s without stopping DOM defaults",
  async (tapPropagation) => {
    const order: string[] = [],
      bubbled = vi.fn()
    const view = render(
      <motion.div
        data-testid="parent"
        onTapStart={() => order.push("parent-start")}
        onTap={() => order.push("parent-end")}
      >
        <motion.div
          data-testid="child"
          propagate={{ tap: tapPropagation }}
          onTapStart={() => order.push("child-start")}
          onTap={() => order.push("child-end")}
        />
      </motion.div>,
    )
    window.addEventListener("pointerdown", bubbled)
    const child = view.getByTestId("child"),
      down = pointer("pointerdown"),
      up = pointer("pointerup")
    fireEvent(child, down)
    fireEvent(child, up)
    const expected =
      tapPropagation === false
        ? ["child-start", "child-end"]
        : ["child-start", "parent-start", "child-end", "parent-end"]
    await vi.waitFor(() => expect(order).toEqual(expected))
    expect(bubbled).toHaveBeenCalledTimes(1)
    expect(bubbled.mock.calls[0][0]).toBe(down)
    expect(down.defaultPrevented).toBe(false)
    window.removeEventListener("pointerdown", bubbled)
    records.push({
      case: "nested tap propagation",
      tapPropagation: tapPropagation ?? "default",
      order,
      originalDefaultDelivery: true,
    })
  },
)

it("observes an outside press/release on the actual window for globalTapTarget", async () => {
  const started = vi.fn(),
    tapped = vi.fn(),
    cancelled = vi.fn()
  const view = render(
    <>
      <motion.div data-testid="global" globalTapTarget onTapStart={started} onTap={tapped} onTapCancel={cancelled} />
      <button data-testid="outside">Outside</button>
    </>,
  )
  const outside = view.getByTestId("outside"),
    down = pointer("pointerdown", 41),
    up = pointer("pointerup", 92)
  fireEvent(outside, down)
  fireEvent(document.body, up)
  await vi.waitFor(() => expect(tapped).toHaveBeenCalledTimes(1))
  expect(started.mock.calls[0][0]).toBe(down)
  expect(tapped.mock.calls[0][0]).toBe(up)
  expect(started.mock.calls[0][1]).toEqual({ point: { x: 41, y: 30 } })
  expect(cancelled).not.toHaveBeenCalled()
  expect(down.defaultPrevented).toBe(false)
  records.push({
    case: "global outside press/release",
    originalEvents: true,
    startPoint: started.mock.calls[0][1],
    endPoint: tapped.mock.calls[0][1],
  })
})

it("lets a nested local propagation claim suppress window-wide tap listeners", async () => {
  const local = vi.fn(),
    global = vi.fn()
  const view = render(
    <>
      <motion.div globalTapTarget onTap={global} />
      <motion.div data-testid="local" propagate={{ tap: false }} onTap={local} />
    </>,
  )
  const target = view.getByTestId("local")
  fireEvent(target, pointer("pointerdown"))
  fireEvent(target, pointer("pointerup"))
  await vi.waitFor(() => expect(local).toHaveBeenCalledTimes(1))
  expect(global).not.toHaveBeenCalled()
  records.push({ case: "local claim before global listener", local: 1, global: 0 })
})

it("captures global targeting at feature mount while keeping callbacks current", async () => {
  const first = vi.fn(),
    current = vi.fn()
  const view = render(<motion.div data-testid="target" globalTapTarget={false} onTap={first} />)
  view.rerender(<motion.div data-testid="target" globalTapTarget onTap={current} />)
  fireEvent(document.body, pointer("pointerdown"))
  fireEvent(document.body, pointer("pointerup"))
  const target = view.getByTestId("target")
  fireEvent(target, pointer("pointerdown"))
  fireEvent(target, pointer("pointerup"))
  await vi.waitFor(() => expect(current).toHaveBeenCalledTimes(1))
  expect(first).not.toHaveBeenCalled()
  records.push({ case: "mounted global option/latest callback", outside: 0, current: 1, first: 0 })
})

it("retains the mounted tap feature and local claim through absent tap props", async () => {
  const parent = vi.fn(),
    first = vi.fn(),
    current = vi.fn()
  const content = (phase: number) => (
    <motion.div onTap={parent}>
      <motion.div
        data-testid="lifetime"
        globalTapTarget={phase > 0}
        propagate={{ tap: phase > 0 }}
        {...(phase === 0 ? { onTap: first } : phase === 2 ? { onTap: current } : {})}
      />
    </motion.div>
  )
  const view = render(content(0))
  const root = view.getByTestId("lifetime")
  view.rerender(content(1))
  expect(root.tabIndex).toBe(-1)
  fireEvent(root, pointer("pointerdown"))
  fireEvent(root, pointer("pointerup"))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(parent).not.toHaveBeenCalled()
  view.rerender(content(2))
  fireEvent(document.body, pointer("pointerdown"))
  fireEvent(document.body, pointer("pointerup"))
  fireEvent(root, pointer("pointerdown"))
  fireEvent(root, pointer("pointerup"))
  await vi.waitFor(() => expect(current).toHaveBeenCalledTimes(1))
  expect(first).not.toHaveBeenCalled()
  expect(parent).not.toHaveBeenCalled()
  records.push({
    case: "tap props removed/restored without feature unmount",
    localClaimRetained: true,
    outside: 0,
    current: 1,
    tabIndex: root.tabIndex,
  })
})
it("retains a live press cycle while tap callbacks disappear and return before release", async () => {
  const started = vi.fn(),
    current = vi.fn(),
    cancelled = vi.fn()
  const content = (phase: number) => (
    <motion.div
      data-testid="held-lifetime"
      {...(phase === 0
        ? { onTapStart: started, onTapCancel: cancelled }
        : phase === 2
          ? { onTap: current, onTapCancel: cancelled }
          : {})}
    />
  )
  const view = render(content(0)),
    root = view.getByTestId("held-lifetime")
  const down = pointer("pointerdown"),
    up = pointer("pointerup")
  fireEvent(root, down)
  await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(1))
  view.rerender(content(1))
  view.rerender(content(2))
  fireEvent(root, up)
  await vi.waitFor(() => expect(current).toHaveBeenCalledTimes(1))
  expect(current.mock.calls[0][0]).toBe(up)
  expect(cancelled).not.toHaveBeenCalled()
  records.push({ case: "held tap props removed/restored", originalRelease: true, taps: 1, cancellations: 0 })
})
it("retains a mounted hover feature with current callbacks after a prop-free enter", async () => {
  const first = vi.fn(),
    current = vi.fn()
  const content = (phase: number) => (
    <motion.div
      data-testid="hover-lifetime"
      {...(phase === 0 ? { onHoverStart: first } : phase === 2 ? { onHoverEnd: current } : {})}
    />
  )
  const view = render(content(0)),
    root = view.getByTestId("hover-lifetime")
  view.rerender(content(1))
  fireEvent(root, pointer("pointerenter"))
  view.rerender(content(2))
  const leave = pointer("pointerleave")
  fireEvent(root, leave)
  await vi.waitFor(() => expect(current).toHaveBeenCalledTimes(1))
  expect(current.mock.calls[0][0]).toBe(leave)
  expect(first).not.toHaveBeenCalled()
  records.push({ case: "hover props removed/restored", originalLeave: true, currentEnds: 1 })
})
it("retains source static-preview tab order without mounting pointer callbacks", () => {
  const view = render(
    <MotionConfig isStatic>
      <motion.div data-testid="static-focus" onTap={() => {}} />
    </MotionConfig>,
  )
  expect(view.getByTestId("static-focus").tabIndex).toBe(0)
  records.push({ case: "static tap focus default", tabIndex: 0 })
})
