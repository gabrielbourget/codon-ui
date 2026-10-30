import { act, render } from "@testing-library/react-native"
import { useLayoutEffect } from "react"

import { NativeFloatingLayerHost } from "../../.."
import { useNativeTooltipTriggerState } from "../useTooltipTriggerState"

type TOptions = Parameters<typeof useNativeTooltipTriggerState>[0]
type TState = ReturnType<typeof useNativeTooltipTriggerState>
const setup = () => {
  let state: TState
  const Probe = ({ options }: { options: TOptions }) => {
    const value = useNativeTooltipTriggerState(options)
    useLayoutEffect(() => {
      state = value
    })
    return null
  }
  const node = (options: TOptions = {}, key = "window") => (
    <NativeFloatingLayerHost key={key}>
      <Probe options={options} />
    </NativeFloatingLayerHost>
  )
  return { node, state: () => state! }
}

it("retains controlled false/true declines through repeated explicit state requests", async () => {
  const f = setup()
  const onOpenChange = jest.fn()
  const result = await render(f.node({ isOpen: false, onOpenChange }))
  await act(() => f.state().open(true))
  await act(() => f.state().open(true))
  expect(f.state().isOpen).toBe(false)
  expect(onOpenChange.mock.calls).toEqual([[true], [true]])
  await result.rerender(f.node({ isOpen: true, onOpenChange }))
  await act(() => f.state().close(true))
  await act(() => f.state().close(true))
  expect(f.state().isOpen).toBe(true)
  expect(onOpenChange.mock.calls).toEqual([[true], [true], [false], [false]])
})

it("reads an uncontrolled default only initially and reports actual state requests", async () => {
  const f = setup()
  const onOpenChange = jest.fn()
  const result = await render(f.node({ defaultOpen: false, onOpenChange }))
  await result.rerender(f.node({ defaultOpen: true, onOpenChange }))
  expect(f.state().isOpen).toBe(false)
  await act(() => f.state().open(true))
  expect(f.state().isOpen).toBe(true)
  await act(() => f.state().close(true))
  expect(f.state().isOpen).toBe(false)
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("uses the latest callback for a pending delayed request and cancels it on window replacement", async () => {
  const f = setup()
  const old = jest.fn(),
    latest = jest.fn()
  const result = await render(f.node({ isOpen: false, onOpenChange: old }))
  jest.useFakeTimers()
  try {
    await act(() => f.state().open())
    await result.rerender(f.node({ isOpen: false, onOpenChange: latest }))
    await act(() => jest.advanceTimersByTime(1500))
    expect(old).not.toHaveBeenCalled()
    expect(latest.mock.calls).toEqual([[true]])
    await act(() => f.state().close(true))
    await result.rerender(f.node({ isOpen: false, onOpenChange: latest }, "replacement"))
    await act(() => f.state().open())
    const retired = f.state()
    await result.unmount()
    await act(() => {
      jest.runAllTimers()
      retired.open(true)
      retired.close(true)
    })
    expect(latest).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
})

it.each(["controlled", "uncontrolled"] as const)(
  "preserves source warnings and requests when leaving %s ownership",
  async (mode) => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {})
    const f = setup()
    const result = await render(f.node(mode === "controlled" ? { isOpen: false } : {}))
    const changed = jest.fn()
    await result.rerender(
      f.node(mode === "controlled" ? { onOpenChange: changed } : { isOpen: false, onOpenChange: changed }),
    )
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("changed from"))
    await act(() => f.state().open(true))
    expect(changed).toHaveBeenCalledWith(true)
    expect(f.state().isOpen).toBe(mode === "controlled")
    warning.mockRestore()
  },
)

it("rejects nonfinite delays before native events can schedule work", async () => {
  const f = setup()
  await expect(render(f.node({ delay: Infinity }))).rejects.toThrow("finite")
})
