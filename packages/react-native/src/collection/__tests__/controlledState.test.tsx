import { act, renderHook } from "@testing-library/react-native"

import { useControlledState } from "../state/useControlledState"

it("resets primitive controlled ownership after each native commit while retaining each vetoed request", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() => useControlledState("owner", "default", request))
  await act(() => result.current[1]((value) => value + ":request"))
  await act(() => result.current[1]((value) => value + ":request"))
  expect(request.mock.calls.map(([value]) => value)).toEqual(["owner:request", "owner:request"])
  expect(result.current[0]).toBe("owner")
})

it("keeps sequential functional updates within one event and resets only at the native commit", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() => useControlledState("owner", "default", request))
  await act(() => {
    result.current[1]((value) => value + ":a")
    result.current[1]((value) => value + ":b")
  })
  await act(() => result.current[1]((value) => value + ":c"))
  expect(request.mock.calls.map(([value]) => value)).toEqual(["owner:a", "owner:a:b", "owner:c"])
  expect(result.current[0]).toBe("owner")
})

it("preserves the source controlled-to-uncontrolled transition and current callback without a fake selection reset", async () => {
  const first = jest.fn(),
    current = jest.fn(),
    warning = jest.spyOn(console, "warn").mockImplementation(() => {})
  try {
    const initialProps: { value: string | undefined; request: (value: string) => void } = {
      value: "owner",
      request: first,
    }
    const { result, rerender } = await renderHook(
      ({ value, request }: { value: string | undefined; request: (value: string) => void }) =>
        useControlledState<string>(value, "default", request),
      { initialProps },
    )
    await act(() => result.current[1]("last-request"))
    await rerender({ value: "echo", request: current })
    await act(() => result.current[1]((value) => value + ":next"))
    await rerender({ value: undefined, request: current })
    expect(result.current[0]).toBe("echo:next")
    expect(first.mock.calls).toEqual([["last-request"]])
    expect(current.mock.calls).toEqual([["echo:next"]])
    expect(warning).toHaveBeenCalledTimes(1)
  } finally {
    warning.mockRestore()
  }
})

it("samples an uncontrolled default once and keeps the caller object unchanged", async () => {
  const owner = Object.freeze({ count: 1 }),
    request = jest.fn()
  const { result, rerender } = await renderHook(
    ({ defaults }: { defaults: { count: number } }) =>
      useControlledState<{ count: number }>(undefined, defaults, request),
    { initialProps: { defaults: owner } },
  )
  await act(() => result.current[1]((value) => ({ count: value.count + 1 })))
  await rerender({ defaults: { count: 99 } })
  expect(result.current[0]).toEqual({ count: 2 })
  expect(owner).toEqual({ count: 1 })
  expect(request.mock.calls).toEqual([[{ count: 2 }]])
})
