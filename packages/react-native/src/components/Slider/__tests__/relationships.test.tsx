import { render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, View } from "react-native"

import { NativeSliderContext, Slider, type SliderProps } from "../../.."

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())
const thumb = (index = 1) => screen.getByTestId(`slider-thumb-${index}-target`)

it("keeps default native names, hints, independent thumbs and values unchanged without ID relationships", async () => {
  await render(
    <Slider label="Range" value={[10, 80]} thumbAriaLabels={["Start", "End"]} accessibilityHint="Adjust values" />,
  )
  expect(thumb().props.accessibilityLabel).toBe("Range, Start")
  expect(thumb(2).props.accessibilityLabel).toBe("Range, End")
  expect(thumb().props.accessibilityHint).toBe("Adjust values")
  expect(thumb()).toHaveAccessibilityValue({ now: 10, max: 80 })
  expect(thumb(2)).toHaveAccessibilityValue({ now: 80, min: 10 })
  expect(thumb().props.nativeLabelledBy).toBeUndefined()
  expect(thumb().props.nativeDescribedBy).toBeUndefined()
  expect(thumb().props.nativeDetailsBy).toBeUndefined()
  expect(screen.getByTestId("slider").props.accessible).toBe(false)
  expect(thumb().props.nativeID).not.toBe(thumb(2).props.nativeID)
})

it("composes each thumb's own name with explicit visible-label IDs and routes descriptions/details to the same original host", async () => {
  const ref = createRef<View>(),
    changed = jest.fn()
  const result = await render(
    <Slider
      ref={ref}
      label="Range"
      labelID="visible-range"
      value={[10, 80]}
      thumbAriaLabels={["Start", "End"]}
      aria-describedby="description  help"
      aria-details="details"
      accessibilityHint="Preserved hint"
      onChange={changed}
    />,
  )
  const original = ref.current
  expect(screen.getByTestId("slider-label").props.nativeID).toBe("visible-range")
  expect(thumb().props.accessibilityLabel).toBe("Start")
  expect(thumb(2).props.accessibilityLabel).toBe("End")
  for (const index of [1, 2]) {
    expect(thumb(index).props.nativeLabelledBy).toEqual([thumb(index).props.nativeID, "visible-range"])
    expect(thumb(index).props.nativeDescribedBy).toEqual(["description", "help"])
    expect(thumb(index).props.nativeDetailsBy).toEqual(["details"])
    expect(thumb(index).props.accessibilityHint).toBe("Preserved hint")
  }
  expect(ref.current).toBe(original)
  expect(changed).not.toHaveBeenCalled()
  await result.unmount()
  expect(ref.current).toBeNull()
})

it("preserves label-ID/native/alias precedence and live clearing without replacing originals or losing explicit root/individual names", async () => {
  const ref = createRef<View>()
  const node = (props: Partial<SliderProps>) => (
    <Slider
      ref={ref}
      label="Visible"
      accessibilityLabel="Explicit group"
      value={[25]}
      thumbAriaLabels={["Amount"]}
      {...props}
    />
  )
  const result = await render(
    node({ labelID: "visible-id", accessibilityLabelledBy: ["native"], "aria-labelledby": "alias" }),
  )
  const original = ref.current,
    ownID = thumb().props.nativeID
  expect(thumb().props.accessibilityLabel).toBe("Explicit group, Amount")
  expect(thumb().props.nativeLabelledBy).toEqual([ownID, "visible-id"])
  const native = ["native", "native", "second"]
  await result.rerender(node({ accessibilityLabelledBy: native, "aria-labelledby": "alias" }))
  expect(thumb().props.nativeLabelledBy).toEqual([ownID, "native", "second"])
  expect(native).toEqual(["native", "native", "second"])
  await result.rerender(node({ "aria-labelledby": "alias first", "aria-describedby": "next", "aria-details": "more" }))
  expect(thumb().props.nativeLabelledBy).toEqual([ownID, "alias", "first"])
  expect(thumb().props.nativeDescribedBy).toEqual(["next"])
  await result.rerender(
    node({ labelID: "", accessibilityLabelledBy: ["native"], "aria-describedby": "", "aria-details": "" }),
  )
  expect(thumb().props.nativeLabelledBy).toEqual([])
  expect(thumb().props.nativeDescribedBy).toEqual([])
  expect(thumb().props.nativeDetailsBy).toEqual([])
  expect(thumb().props.accessibilityLabel).toBe("Explicit group, Amount")
  expect(ref.current).toBe(original)
  expect(thumb().props.nativeID).toBe(ownID)
  expect(thumb()).toHaveAccessibilityValue({ now: 25 })
})

it("applies scoped context relationships with caller overrides and preserves the root renderer's native identity", async () => {
  const result = await render(
    <NativeSliderContext.Provider
      value={{
        "aria-describedby": "context-help",
        "aria-details": "context-details",
        "aria-labelledby": "context-label",
      }}
    >
      <Slider
        label="Visible"
        nativeID="caller-root"
        aria-describedby="caller-help"
        render={(props) => <View {...props} />}
      />
    </NativeSliderContext.Provider>,
  )
  const ownID = thumb().props.nativeID
  expect(screen.getByTestId("slider").props.nativeID).toBe("caller-root")
  expect(thumb().props.nativeLabelledBy).toEqual([ownID, "context-label"])
  expect(thumb().props.nativeDescribedBy).toEqual(["caller-help"])
  expect(thumb().props.nativeDetailsBy).toEqual(["context-details"])
  expect(thumb().props.accessibilityLabel).toBe("Slider Thumb 1")
  await result.rerender(<Slider label="Visible" nativeID="caller-root" />)
  expect(thumb().props.nativeLabelledBy).toBeUndefined()
  expect(thumb().props.nativeDescribedBy).toBeUndefined()
  expect(thumb().props.nativeDetailsBy).toBeUndefined()
  expect(thumb().props.accessibilityLabel).toBe("Visible, Slider Thumb 1")
})

it("accepts a context-slot name or explicit label reference while continuing to reject unresolved unnamed controls", async () => {
  const result = await render(
    <NativeSliderContext.Provider value={{ label: "Context quantity", value: 0 }}>
      <Slider slot="" />
    </NativeSliderContext.Provider>,
  )
  expect(thumb().props.accessibilityLabel).toBe("Context quantity, Slider Thumb 1")
  await result.rerender(<Slider aria-labelledby="outside-label" />)
  expect(thumb().props.accessibilityLabel).toBe("Slider Thumb 1")
  expect(thumb().props.nativeLabelledBy).toEqual([thumb().props.nativeID, "outside-label"])
  await result.unmount()
  await expect(render(<Slider slot="missing-name" />)).rejects.toThrow(
    "Slider: a nonempty native name or label is required",
  )
})
