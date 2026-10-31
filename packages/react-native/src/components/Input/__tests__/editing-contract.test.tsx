import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, TextInput, type TextInputProps } from "react-native"

import { Input, TextArea, type TNativeInputStyleState } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe.each([
  { name: "Input", Component: Input },
  { name: "TextArea", Component: TextArea },
])("$name complete editing counterpart", ({ name, Component }) => {
  it("renders the original native editor/ref with current state, native event identity and guarded editing", async () => {
    const ref = createRef<TextInput>()
    const change = jest.fn()
    const focus = jest.fn()
    const trace: string[] = []
    const renderer = jest.fn((props: TextInputProps & RefAttributes<TextInput>, state: unknown) => {
      trace.push("render")
      return <TextInput {...props} testID="rendered-editor" accessibilityHint={JSON.stringify(state)} />
    })
    const adapter = { render: renderer }
    const view = await render(
      <Component
        {...adapter}
        aria-label="Editor"
        ref={ref}
        value="Original"
        onChange={change}
        onFocus={focus}
        style={({ defaultStyle }) => {
          trace.push("style")
          return defaultStyle
        }}
      />,
    )
    expect(renderer).toHaveBeenCalled()
    expect(trace.slice(0, 2)).toEqual(["style", "render"])
    const original = ref.current
    expect(original).not.toBeNull()
    expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
    expect(renderer.mock.calls.at(-1)?.[0].multiline).toBe(name === "TextArea")
    expect(renderer.mock.calls.at(-1)?.[1]).toEqual({
      isFocused: false,
      isDisabled: false,
      isReadOnly: false,
      isInvalid: false,
    })
    const event = { nativeEvent: { text: "Native", target: 1, eventCount: 1 } }
    await fireEvent(screen.getByTestId("rendered-editor"), "focus", event)
    expect(focus.mock.calls[0][0]).toBe(event)
    expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isFocused: true })
    await fireEvent(screen.getByTestId("rendered-editor"), "change", event)
    expect(change.mock.calls[0][0]).toBe(event)
    await view.rerender(
      <Component {...adapter} aria-label="Editor" ref={ref} value="Echo" isReadOnly errorState onChange={change} />,
    )
    expect(ref.current).toBe(original)
    expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isFocused: true, isReadOnly: true, isInvalid: true })
    expect(screen.getByTestId("rendered-editor")).toHaveDisplayValue("Echo")
    await fireEvent(screen.getByTestId("rendered-editor"), "change", event)
    expect(change).toHaveBeenCalledTimes(1)
    await view.unmount()
    expect(ref.current).toBeNull()
  })

  it("transitions final authored border color for 250ms with the complete canonical easing curve", async () => {
    const timing = jest.spyOn(Animated, "timing")
    const view = await render(
      <Component aria-label="Editor" customStyles={{ borderColor: "#ff0000" }} style={{ borderColor: "#000000" }} />,
    )
    timing.mockClear()
    await view.rerender(
      <Component aria-label="Editor" customStyles={{ borderColor: "#ff0000" }} style={{ borderColor: "#ffffff" }} />,
    )
    expect(screen.getByTestId(name === "Input" ? "input" : "textarea")).toHaveStyle({ borderColor: "#000000" })
    const config = timing.mock.calls.at(-1)?.[1]
    expect(config?.duration).toBe(250)
    for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config?.easing?.(fraction)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(fraction), 6)
    await act(() => jest.advanceTimersByTime(125))
    const color = screen.getByTestId(name === "Input" ? "input" : "textarea").props.style.borderColor
    expect(color).toMatch(/^rgba\(/)
    expect(color).not.toBe("rgba(255, 255, 255, 1)")
    await act(() => jest.advanceTimersByTime(150))
    expect(screen.getByTestId(name === "Input" ? "input" : "textarea")).toHaveStyle({ borderColor: "#ffffff" })
  })

  it("interrupts from current paint, applies live Reduce Motion and stops its owned animation on unmount", async () => {
    const listeners = jest.spyOn(AccessibilityInfo, "addEventListener")
    const timing = jest.spyOn(Animated, "timing")
    const view = await render(<Component aria-label="Editor" style={{ borderColor: "#000000" }} />)
    await view.rerender(<Component aria-label="Editor" style={{ borderColor: "#ffffff" }} />)
    await act(() => jest.advanceTimersByTime(125))
    const editor = () => screen.getByTestId(name === "Input" ? "input" : "textarea")
    const current = editor().props.style.borderColor
    expect(current).toMatch(/^rgba\(/)
    await view.rerender(<Component aria-label="Editor" style={{ borderColor: "#ff0000" }} />)
    expect(editor().props.style.borderColor).toBe(current)
    const stop = jest.spyOn(timing.mock.results.at(-1)!.value, "stop")
    const calls = listeners.mock.calls as unknown as Array<[string, (value: boolean) => void]>
    const changed = calls.filter(([event]) => event === "reduceMotionChanged").at(-1)![1]
    await act(() => changed(true))
    expect(editor()).toHaveStyle({ borderColor: "#ff0000" })
    expect(stop).toHaveBeenCalled()
    await act(() => changed(false))
    await view.rerender(<Component aria-label="Editor" style={{ borderColor: "#0000ff" }} />)
    const cleanup = jest.spyOn(timing.mock.results.at(-1)!.value, "stop")
    await view.unmount()
    expect(cleanup).toHaveBeenCalled()
  })

  it("retains native opaque colors and the target defaultStyle through validation and final overrides", async () => {
    const style = jest.fn(({ defaultStyle }: TNativeInputStyleState) => defaultStyle)
    const view = await render(<Component aria-label="Editor" errorState warningState successState style={style} />)
    expect(style.mock.calls.at(-1)?.[0].defaultStyle.borderColor).toBe("#b73434")
    const color = PlatformColor("native-editor-border")
    await view.rerender(
      <Component
        aria-label="Editor"
        errorState
        customStyles={{ borderColor: "#ff0000" }}
        style={{ borderColor: color }}
      />,
    )
    expect(screen.getByTestId(name === "Input" ? "input" : "textarea").props.style.borderColor).toBe(color)
  })
})
