import { act, render } from "@testing-library/react-native"
import { createRef } from "react"
import { View } from "react-native"

import { NativeDragPreview } from "../hooks"

it("mounts caller-authored content before any drag and forwards its actual View ref and layout event", async () => {
  const ref = createRef<View>(),
    onLayout = jest.fn()
  const fixture = await render(
    <NativeDragPreview ref={ref} testID="prepared" onLayout={onLayout}>
      <View testID="authored" />
    </NativeDragPreview>,
  )
  const original = ref.current
  expect(original).toBeTruthy()
  expect(fixture.getByTestId("authored", { includeHiddenElements: true })).toBeTruthy()
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 30, height: 40 } } }
  await act(() => fixture.getByTestId("prepared", { includeHiddenElements: true }).props.onLayout(event))
  expect(onLayout).toHaveBeenCalledWith(event)
  expect(onLayout.mock.calls[0][0]).toBe(event)
  await fixture.rerender(
    <NativeDragPreview ref={ref} testID="prepared">
      <View testID="replacement-content" />
    </NativeDragPreview>,
  )
  expect(ref.current).toBe(original)
  expect(fixture.getByTestId("replacement-content", { includeHiddenElements: true })).toBeTruthy()
  await fixture.unmount()
  expect(ref.current).toBeNull()
})
