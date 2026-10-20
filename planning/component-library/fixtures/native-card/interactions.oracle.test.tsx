import { writeFileSync } from "node:fs"

import { fireEvent, render } from "@testing-library/react"
import { motion } from "motion/react"
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
