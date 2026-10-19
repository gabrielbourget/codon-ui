import { act, render, screen } from "@testing-library/react-native"
import { memo, useLayoutEffect } from "react"
import { AccessibilityInfo, Text, TextInput } from "react-native"

import { useNativeMotionValue } from "../animation/hooks"
import { NativeMotionConfig, useNativeMotionConfig, useNativeMotionReducedMotion } from "../config"
import type { TNativeMotionConfig } from "../config"
import type { MotionValue } from "../kernel"

let nativeChange: (value: boolean) => void
let remove: jest.Mock
beforeEach(() => {
  nativeChange = () => {}
  remove = jest.fn()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((event: unknown, listener: unknown) => {
    if (event === "reduceMotionChanged" && typeof listener === "function")
      nativeChange = listener as (value: boolean) => void
    return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => jest.restoreAllMocks())

it("retains pinned defaults and the original zero-valued point", async () => {
  let config: TNativeMotionConfig = {}
  const Probe = () => {
    config = useNativeMotionConfig()
    return null
  }
  await render(<Probe />)
  expect(config).toMatchObject({ isStatic: false, reducedMotion: "never" })
  const point = { x: 0, y: 0 }
  expect(config.transformPagePoint?.(point)).toBe(point)
})

it("inherits scopes and shallow-merges only explicitly inheriting transitions", async () => {
  const configs: TNativeMotionConfig[] = []
  const Probe = () => {
    configs.push(useNativeMotionConfig())
    return null
  }
  await render(
    <NativeMotionConfig transition={{ duration: 2, opacity: { delay: 1 } }} reducedMotion="user" skipAnimations>
      <NativeMotionConfig transition={{ inherit: true, ease: "linear" }}>
        <Probe />
      </NativeMotionConfig>
      <NativeMotionConfig transition={{ duration: 0 }} skipAnimations={false}>
        <Probe />
      </NativeMotionConfig>
      <Probe />
    </NativeMotionConfig>,
  )
  expect(configs[0]).toMatchObject({
    transition: { duration: 2, opacity: { delay: 1 }, ease: "linear" },
    reducedMotion: "user",
    skipAnimations: true,
  })
  expect(configs[0].transition).not.toHaveProperty("inherit")
  expect(configs[1]).toMatchObject({ transition: { duration: 0 }, skipAnimations: false })
  expect(configs[2].transition).toEqual({ duration: 2, opacity: { delay: 1 } })
})

it("preserves explicit undefined instead of resurrecting inherited values", async () => {
  let config: TNativeMotionConfig = {}
  const Probe = () => {
    config = useNativeMotionConfig()
    return null
  }
  await render(
    <NativeMotionConfig transition={{ duration: 2 }} skipAnimations reducedMotion="always">
      <NativeMotionConfig transition={undefined} skipAnimations={undefined} reducedMotion={undefined}>
        <Probe />
      </NativeMotionConfig>
    </NativeMotionConfig>,
  )
  expect(config.transition).toBeUndefined()
  expect(config.skipAnimations).toBeUndefined()
  expect(config.reducedMotion).toBeUndefined()
})

it("retains context identity for equivalent transitions and freezes mounted static mode", async () => {
  const configs: TNativeMotionConfig[] = []
  const Probe = memo(() => {
    configs.push(useNativeMotionConfig())
    return null
  })
  await render(
    <NativeMotionConfig isStatic transition={{ duration: 1 }}>
      <Probe />
    </NativeMotionConfig>,
  )
  await screen.rerender(
    <NativeMotionConfig isStatic={false} transition={{ duration: 1 }}>
      <Probe />
    </NativeMotionConfig>,
  )
  expect(configs).toHaveLength(1)
  await screen.rerender(
    <NativeMotionConfig isStatic={false} transition={{ duration: 2 }}>
      <Probe />
    </NativeMotionConfig>,
  )
  expect(configs).toHaveLength(2)
  expect(configs[1].isStatic).toBe(true)
  expect(configs[1].transition?.duration).toBe(2)
})

it("updates point conversion and skip independently without remounting descendants", async () => {
  const mounted = jest.fn(),
    retired = jest.fn(),
    request = jest.fn()
  const first = (point: { x: number; y: number }) => ({ x: point.x + 10, y: point.y })
  const second = (point: { x: number; y: number }) => ({ x: point.x, y: point.y + 20 })
  let config: TNativeMotionConfig = {}
  const Probe = () => {
    config = useNativeMotionConfig()
    useLayoutEffect(() => {
      mounted()
      return retired
    }, [])
    return <TextInput testID="editor" value="" onChangeText={request} />
  }
  await render(
    <NativeMotionConfig transformPagePoint={first}>
      <Probe />
    </NativeMotionConfig>,
  )
  const editor = screen.getByTestId("editor")
  await screen.rerender(
    <NativeMotionConfig transformPagePoint={second} skipAnimations>
      <Probe />
    </NativeMotionConfig>,
  )
  expect(config.transformPagePoint).toBe(second)
  expect(config.transformPagePoint?.({ x: 0, y: 0 })).toEqual({ x: 0, y: 20 })
  expect(config.skipAnimations).toBe(true)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(request).not.toHaveBeenCalled()
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(retired).not.toHaveBeenCalled()
})

it.each([false, true])("subscribes to hook values only for mounted static mode %s", async (isStatic) => {
  let value: MotionValue<number> | undefined
  let unsubscribe: jest.Mock | undefined
  let renders = 0
  const Probe = () => {
    renders++
    const current = useNativeMotionValue(0)
    if (value !== current) {
      const subscribe = current.on.bind(current)
      jest.spyOn(current, "on").mockImplementation((event, callback) => {
        const retire = jest.fn(subscribe(event, callback))
        if (event === "change") unsubscribe = retire
        return retire
      })
    }
    value = current
    return <Text testID="value">{value.get()}</Text>
  }
  await render(
    <NativeMotionConfig isStatic={isStatic}>
      <Probe />
    </NativeMotionConfig>,
  )
  const first = value
  const initialRenders = renders
  await act(() => value!.set(2))
  expect(value).toBe(first)
  expect(renders).toBe(initialRenders + (isStatic ? 1 : 0))
  expect(screen.getByTestId("value").props.children).toBe(isStatic ? 2 : 0)
  await screen.unmount()
  if (isStatic) expect(unsubscribe).toHaveBeenCalledTimes(1)
  else expect(unsubscribe).toBeUndefined()
  const finalRenders = renders
  await act(() => value!.set(3))
  expect(renders).toBe(finalRenders)
  value!.destroy()
})

it("keeps function values as untouched data in static preview", async () => {
  const initial = jest.fn(() => 1),
    next = jest.fn(() => 2)
  let value: MotionValue<typeof initial> | undefined
  const Probe = () => {
    value = useNativeMotionValue(initial)
    return null
  }
  await render(
    <NativeMotionConfig isStatic>
      <Probe />
    </NativeMotionConfig>,
  )
  expect(value?.get()).toBe(initial)
  await act(() => value!.set(next))
  expect(value?.get()).toBe(next)
  expect(initial).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
  await screen.unmount()
  value!.destroy()
})

it("uses live native preference in user mode and ignores a late initial query", async () => {
  let resolve!: (value: boolean) => void
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  const Probe = () => <Text testID="reduced">{String(useNativeMotionReducedMotion())}</Text>
  await render(
    <NativeMotionConfig reducedMotion="user">
      <Probe />
    </NativeMotionConfig>,
  )
  expect(screen.getByTestId("reduced").props.children).toBe("true")
  await act(() => nativeChange(false))
  expect(screen.getByTestId("reduced").props.children).toBe("false")
  await act(() => resolve(true))
  expect(screen.getByTestId("reduced").props.children).toBe("false")
  await act(() => nativeChange(true))
  expect(screen.getByTestId("reduced").props.children).toBe("true")
  await screen.unmount()
  expect(remove).toHaveBeenCalledTimes(1)
})

it("keeps always/never scoped while retaining current native preference for user mode", async () => {
  const Probe = () => <Text testID="reduced">{String(useNativeMotionReducedMotion())}</Text>
  await render(
    <NativeMotionConfig reducedMotion="always">
      <Probe />
    </NativeMotionConfig>,
  )
  await act(() => nativeChange(false))
  expect(screen.getByTestId("reduced").props.children).toBe("true")
  await screen.rerender(
    <NativeMotionConfig reducedMotion="never">
      <Probe />
    </NativeMotionConfig>,
  )
  await act(() => nativeChange(true))
  expect(screen.getByTestId("reduced").props.children).toBe("false")
  await screen.rerender(
    <NativeMotionConfig reducedMotion="user">
      <Probe />
    </NativeMotionConfig>,
  )
  expect(screen.getByTestId("reduced").props.children).toBe("true")
})

it("retains reduced presentation on an unavailable initial native preference", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("unavailable"))
  const Probe = () => <Text testID="reduced">{String(useNativeMotionReducedMotion())}</Text>
  await render(
    <NativeMotionConfig reducedMotion="user">
      <Probe />
    </NativeMotionConfig>,
  )
  expect(screen.getByTestId("reduced").props.children).toBe("true")
})
