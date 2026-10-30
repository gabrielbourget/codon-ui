import { render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import { AccessibilityInfo, type View } from "react-native"

import {
  CircularProgress,
  NativeFocusView,
  Text,
  type TNativeCircularProgressRootRender,
  type TNativeCircularProgressStyleState,
} from "../../.."

const UnmountedLabel = jest.fn(() => <Text>Value label content must stay unmounted</Text>)
const element = <UnmountedLabel />
const fragment = <>One quarter</>
const array = ["1", " of ", 4]
const promise = Promise.resolve("One quarter")
const cases: { name: string; label: ReactNode; expectedText: string; expectedState: ReactNode }[] = [
  { name: "undefined", label: undefined, expectedText: "25%", expectedState: "25%" },
  { name: "null", label: null, expectedText: "25%", expectedState: "25%" },
  { name: "false", label: false, expectedText: "25%", expectedState: "25%" },
  { name: "empty string", label: "", expectedText: "25%", expectedState: "25%" },
  { name: "numeric zero", label: 0, expectedText: "25%", expectedState: "25%" },
  { name: "bigint zero", label: 0n, expectedText: "25%", expectedState: "25%" },
  { name: "numeric label", label: 4, expectedText: "4", expectedState: 4 },
  { name: "bigint label", label: 4n, expectedText: "4", expectedState: 4n },
  { name: "string zero", label: "0", expectedText: "0", expectedState: "0" },
  { name: "true", label: true, expectedText: "true", expectedState: true },
  { name: "text", label: "One quarter", expectedText: "One quarter", expectedState: "One quarter" },
  { name: "array", label: array, expectedText: "1, of ,4", expectedState: array },
  { name: "fragment", label: fragment, expectedText: "[object Object]", expectedState: fragment },
  { name: "element", label: element, expectedText: "[object Object]", expectedState: element },
  { name: "promise", label: promise, expectedText: "[object Promise]", expectedState: promise },
]

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe("CircularProgress inherited valueLabel contract", () => {
  it.each(cases)(
    "retains $name callback identity and native semantic serialization without rendering it",
    async (testCase) => {
      const style = jest.fn((state: TNativeCircularProgressStyleState) => ({
        opacity: state.isIndeterminate ? 0.5 : 1,
      }))
      const renderer = jest.fn(
        (
          props: Parameters<TNativeCircularProgressRootRender>[0],
          _state: Parameters<TNativeCircularProgressRootRender>[1],
        ) => <NativeFocusView {...props} />,
      )
      await render(
        <CircularProgress aria-label="Task" value={25} valueLabel={testCase.label} style={style} render={renderer} />,
      )
      const progress = screen.getByRole("progressbar", { name: "Task" })
      expect(progress).toHaveAccessibilityValue({ now: 25, text: testCase.expectedText })
      expect(renderer.mock.calls.at(-1)?.[0]["aria-valuetext"]).toBe(testCase.expectedText)
      expect(style.mock.calls.at(-1)?.[0].valueText).toBe(testCase.expectedState)
      expect(screen.queryByText("Value label content must stay unmounted")).toBeNull()
      expect(screen.queryByTestId("circular-progress-text", { includeHiddenElements: true })).toBeNull()
      expect(UnmountedLabel).not.toHaveBeenCalled()
    },
  )

  it.each(cases)("omits $name label from indeterminate semantics and render state", async (testCase) => {
    const style = jest.fn((state: TNativeCircularProgressStyleState) => ({ opacity: state.isIndeterminate ? 0.5 : 1 }))
    await render(
      <CircularProgress aria-label="Task" value={25} valueLabel={testCase.label} isIndeterminate style={style} />,
    )
    const progress = screen.getByRole("progressbar", { name: "Task" })
    expect(progress.props.accessibilityValue.text).toBeUndefined()
    expect(progress.props["aria-valuetext"]).toBeUndefined()
    expect(style.mock.calls.at(-1)?.[0].valueText).toBeUndefined()
    expect(style.mock.calls.at(-1)?.[0].percentage).toBeUndefined()
    expect(UnmountedLabel).not.toHaveBeenCalled()
  })

  it("retains the native ref, owner zero and visible text through label replacement and locale formatting", async () => {
    const ref = createRef<View>()
    const style = jest.fn((state: TNativeCircularProgressStyleState) => ({ opacity: state.isIndeterminate ? 0.5 : 1 }))
    const { rerender } = await render(
      <CircularProgress ref={ref} value={0} valueLabel={element} text="Visible zero" style={style} />,
    )
    const current = ref.current
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 0, text: "[object Object]" })
    await rerender(
      <CircularProgress ref={ref} value={0} valueLabel={false} locale="fr-CA" text="Visible zero" style={style} />,
    )
    expect(ref.current).toBe(current)
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 0, text: "0 %" })
    expect(style.mock.calls.at(-1)?.[0].valueText).toBe("0 %")
    expect(screen.getByTestId("circular-progress-text", { includeHiddenElements: true })).toBeOnTheScreen()
    expect(UnmountedLabel).not.toHaveBeenCalled()
  })
})
