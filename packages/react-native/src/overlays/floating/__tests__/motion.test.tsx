import { act, render } from "@testing-library/react-native"
import { useLayoutEffect } from "react"
import { AccessibilityInfo, Animated } from "react-native"

import { NativeFloatingLayerHost } from "../../.."
import { useNativeFloatingMotion } from "../motion"
import { useNativeFloatingHost } from "../NativeFloatingLayerHost"
import { useNativeFloatingLayer } from "../useFloatingLayer"

type TSnapshot = {
  layer: ReturnType<typeof useNativeFloatingLayer>
  motion: ReturnType<typeof useNativeFloatingMotion>
}
type TOptions = { open?: boolean; ready?: boolean; entering?: boolean; exiting?: boolean }
type TFinish = NonNullable<Parameters<Animated.CompositeAnimation["start"]>[0]>
const animations: {
  finish?: TFinish
  stop: jest.Mock
  target: Parameters<typeof Animated.timing>[1]["toValue"]
}[] = []
let preference: ((value: boolean) => void) | undefined
beforeEach(() => {
  animations.splice(0)
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const subscribe = (event: string, listener: unknown): { remove: () => void } => {
    if (event === "reduceMotionChanged" && typeof listener === "function")
      preference = listener as (value: boolean) => void
    return { remove: jest.fn() }
  }
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation(subscribe as typeof AccessibilityInfo.addEventListener)
  jest.spyOn(Animated, "timing").mockImplementation((_value, config) => {
    const item: (typeof animations)[number] = { target: config.toValue, stop: jest.fn() }
    animations.push(item)
    return {
      start: (finish) => {
        item.finish = finish
      },
      stop: item.stop,
      reset: jest.fn(),
    }
  })
})
afterEach(() => jest.restoreAllMocks())
const Probe = ({ options, observe }: { options: TOptions; observe: (snapshot: TSnapshot) => void }) => {
  const host = useNativeFloatingHost()
  const { open = true, ready = true, entering = false, exiting = false } = options
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: null,
    isOpen: open,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss: () => undefined,
  })
  const motion = useNativeFloatingMotion(layer, ready, open, entering, exiting)
  useLayoutEffect(() => {
    if (ready && layer.phase === "entering") layer.entered()
  }, [ready, layer.phase, layer.generation])
  useLayoutEffect(() => {
    observe({ layer, motion })
  })
  return null
}
const setup = () => {
  let snapshot: TSnapshot
  const observe = (value: TSnapshot) => {
    snapshot = value
  }
  const node = (options: TOptions = {}) => (
    <NativeFloatingLayerHost>
      <Probe options={options} observe={observe} />
    </NativeFloatingLayerHost>
  )
  return { node, snapshot: () => snapshot! }
}

it("runs the canonical250ms native opacity recipe and releases the animation override on completion", async () => {
  const f = setup()
  await render(f.node())
  expect(Animated.timing).toHaveBeenLastCalledWith(
    expect.any(Animated.Value),
    expect.objectContaining({ toValue: 1, duration: 250, useNativeDriver: true, isInteraction: false }),
  )
  expect(f.snapshot().motion.isEntering).toBe(true)
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  expect(f.snapshot().motion.isEntering).toBe(false)
  expect(f.snapshot().motion.style).toBeUndefined()
})

it("retires exit only after the matching finished callback and ignores an old entry completion", async () => {
  const f = setup()
  const result = await render(f.node())
  const entry = animations.at(-1)!
  await result.rerender(f.node({ open: false }))
  expect(entry.stop).toHaveBeenCalled()
  const exit = animations.at(-1)!
  expect(exit.target).toBe(0)
  await act(() => entry.finish!({ finished: true }))
  expect(f.snapshot().layer.phase).toBe("exiting")
  await act(() => exit.finish!({ finished: true }))
  expect(f.snapshot().layer.mounted).toBe(false)
})

it("finishes an old exit before admitting a queued caller-owned reopen", async () => {
  const f = setup()
  const result = await render(f.node())
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  await result.rerender(f.node({ open: false }))
  const exit = animations.at(-1)!
  await result.rerender(f.node({ open: true }))
  expect(f.snapshot().layer.phase).toBe("exiting")
  await act(() => exit.finish!({ finished: true }))
  expect(f.snapshot().layer.active).toBe(true)
  expect(animations.at(-1)!.target).toBe(1)
})

it("holds a forced exit after motion completes and releases it without replaying the fade", async () => {
  const f = setup()
  const result = await render(f.node())
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  await result.rerender(f.node({ open: false, exiting: true }))
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  expect(f.snapshot().layer.phase).toBe("exiting")
  const count = animations.length
  await result.rerender(f.node({ open: false, exiting: false }))
  expect(f.snapshot().layer.mounted).toBe(false)
  expect(animations).toHaveLength(count)
})

it("honors live Reduce Motion and does not restart a finished entry when the preference returns", async () => {
  const f = setup()
  await render(f.node())
  const entry = animations.at(-1)!
  await act(() => preference!(true))
  expect(entry.stop).toHaveBeenCalled()
  expect(f.snapshot().motion.style).toBeUndefined()
  const count = animations.length
  await act(() => preference!(false))
  expect(animations).toHaveLength(count)
})

it("does not replay a forced entry when its flag is removed", async () => {
  const f = setup()
  const result = await render(f.node())
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  await result.rerender(f.node({ entering: true }))
  expect(animations).toHaveLength(2)
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  await result.rerender(f.node({ entering: false }))
  expect(animations).toHaveLength(2)
  expect(f.snapshot().motion.style).toBeUndefined()
})

it("removes a forced exit from a still-open presentation without inventing an entry animation", async () => {
  const f = setup()
  const result = await render(f.node({ exiting: true }))
  expect(animations.at(-1)!.target).toBe(0)
  await act(() => animations.at(-1)!.finish!({ finished: true }))
  expect(f.snapshot().layer.active).toBe(true)
  const count = animations.length
  await result.rerender(f.node())
  expect(animations).toHaveLength(count)
  expect(f.snapshot().motion.isEntering).toBe(false)
  expect(f.snapshot().motion.style).toBeUndefined()
})

it("retires an unpositioned close and ignores a retained completion after unmount", async () => {
  const f = setup()
  const result = await render(f.node({ ready: false }))
  await result.rerender(f.node({ open: false, ready: false }))
  expect(f.snapshot().layer.mounted).toBe(false)
  expect(animations).toHaveLength(0)
  await result.rerender(f.node())
  const entry = animations.at(-1)!
  await result.unmount()
  expect(entry.stop).toHaveBeenCalled()
  await act(() => entry.finish!({ finished: true }))
})
