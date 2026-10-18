import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { useLayoutEffect } from "react"

import { NativeFloatingLayerHost } from "../../.."
import type { TNativeFloatingMeasurable } from "../measurement"
import { useNativeFloatingHost } from "../NativeFloatingLayerHost"
import type { TNativeFloatingRect } from "../placement"
import { useNativeFloatingLayer } from "../useFloatingLayer"
import { useNativeFloatingPosition } from "../useFloatingPosition"

type TProps = Omit<Parameters<typeof useNativeFloatingPosition>[0], "layer"> & { open?: boolean }
type TSnapshot = {
  host: ReturnType<typeof useNativeFloatingHost>
  layer: ReturnType<typeof useNativeFloatingLayer>
  position: ReturnType<typeof useNativeFloatingPosition>
}
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
beforeEach(() => {
  frames.clear()
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) frames.delete(id)
  })
})
afterEach(() => jest.restoreAllMocks())
const tick = async () =>
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(17)
  })
const measurable = (read: () => TNativeFloatingRect): TNativeFloatingMeasurable => ({
  measureInWindow: (callback) => {
    const rect = read()
    callback(rect.x, rect.y, rect.width, rect.height)
  },
})
const Probe = ({
  options: { open = true, ...options },
  observe,
}: {
  options: TProps
  observe: (value: TSnapshot) => void
}) => {
  const host = useNativeFloatingHost()
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: null,
    isOpen: open,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss: () => undefined,
  })
  const position = useNativeFloatingPosition({ ...options, layer })
  useLayoutEffect(() => {
    observe({ host, layer, position })
  })
  return null
}
const setup = () => {
  const rects = {
    host: { x: 100, y: 200, width: 300, height: 400 },
    anchor: { x: 180, y: 250, width: 40, height: 20 },
    content: { x: 0, y: 0, width: 100, height: 80 },
    boundary: { x: 130, y: 240, width: 180, height: 100 },
  }
  const triggerRef = { current: measurable(() => rects.anchor) as TNativeFloatingMeasurable | null }
  const contentRef = { current: measurable(() => rects.content) as TNativeFloatingMeasurable | null }
  const boundaryRef = { current: measurable(() => rects.boundary) as TNativeFloatingMeasurable | null }
  let snapshot: TSnapshot
  const observe = (value: TSnapshot) => {
    snapshot = value
  }
  const node = (options: Partial<TProps> = {}) => (
    <NativeFloatingLayerHost testID="host">
      <Probe options={{ triggerRef, contentRef, ...options }} observe={observe} />
    </NativeFloatingLayerHost>
  )
  const ready = async () => {
    jest.spyOn(snapshot!.host.root.current!, "measureInWindow").mockImplementation((callback) => {
      const rect = rects.host
      callback(rect.x, rect.y, rect.width, rect.height)
    })
    await fireEvent(screen.getByTestId("host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: rects.host.width, height: rects.host.height } },
    })
  }
  return { rects, triggerRef, contentRef, boundaryRef, node, ready, snapshot: () => snapshot! }
}

it("waits for host layout and uses measured window coordinates in the native host's coordinate space", async () => {
  const f = setup()
  await render(f.node())
  expect(f.snapshot().position).toBeNull()
  expect(frames.size).toBe(0)
  await f.ready()
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 50, y: 78, width: 100, height: 80 })
  f.rects.anchor = { x: 220, y: 280, width: 40, height: 20 }
  await tick()
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 90, y: 108, width: 100, height: 80 })
})

it("intersects an actual measured boundary rather than substituting screen dimensions", async () => {
  const f = setup()
  await render(f.node({ boundaryRef: f.boundaryRef }))
  await f.ready()
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 50, y: 78, width: 100, height: 50 })
  expect(f.snapshot().position?.maxHeight).toBe(50)
})

it("computes the initial position with updates disabled, then freezes only that presentation's geometry", async () => {
  const f = setup()
  const result = await render(f.node({ shouldUpdatePosition: false }))
  await f.ready()
  expect(f.snapshot().position?.hostFrame.x).toBe(50)
  expect(frames.size).toBe(0)
  f.rects.anchor = { ...f.rects.anchor, x: 220 }
  await result.rerender(f.node({ shouldUpdatePosition: false, offset: 0 }))
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 50, y: 78, width: 100, height: 80 })
  await result.rerender(f.node({ shouldUpdatePosition: true, offset: 0 }))
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 90, y: 70, width: 100, height: 80 })
})

it("preserves explicit zero constraints and resolves live logical RTL placement", async () => {
  const f = setup()
  const result = await render(f.node({ placement: "bottom start", direction: "ltr", offset: 0, maxHeight: 0 }))
  await f.ready()
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 80, y: 70, width: 100, height: 0 })
  await result.rerender(f.node({ placement: "bottom start", direction: "rtl", offset: 0, maxHeight: 0 }))
  expect(f.snapshot().position?.hostFrame).toEqual({ x: 20, y: 70, width: 100, height: 0 })
})

it("keeps exit geometry but retires pending frame work and starts a fresh reopened presentation", async () => {
  const f = setup()
  const result = await render(f.node())
  await f.ready()
  await act(() => {
    f.snapshot().layer.entered()
  })
  const original = f.snapshot().position
  await result.rerender(f.node({ open: false }))
  expect(f.snapshot().position).toBe(original)
  expect(frames.size).toBe(0)
  await act(() => {
    f.snapshot().layer.exited()
  })
  expect(f.snapshot().position).toBeNull()
  f.rects.anchor = { ...f.rects.anchor, x: 220 }
  await result.rerender(f.node())
  expect(f.snapshot().position?.hostFrame.x).toBe(90)
})

it("ignores a retained observer frame after unmount", async () => {
  const f = setup()
  const result = await render(f.node())
  await f.ready()
  const retained = [...frames.values()]
  await result.unmount()
  expect(frames.size).toBe(0)
  await act(() => {
    for (const callback of retained) callback(18)
  })
  expect(frames.size).toBe(0)
})
