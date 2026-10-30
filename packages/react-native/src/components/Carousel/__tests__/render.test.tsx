import { render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { CarouselCloseButton, CarouselNextButton, CarouselPrevButton, NativeFocusView } from "../../.."
import { DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS, NativeCarouselControlsContext } from "../context"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it.each([CarouselCloseButton, CarouselPrevButton, CarouselNextButton])(
  "retains original native ref, activation and late renderer ownership through %s",
  async (Component) => {
    const ref = createRef<View>()
    const pressed = jest.fn()
    const outer = jest.fn()
    const inner = jest.fn()
    const view = await render(
      <NativeCarouselControlsContext.Provider
        value={{
          canScrollPrev: true,
          canScrollNext: true,
          scrollPrev: jest.fn(),
          scrollNext: jest.fn(),
          labels: DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS,
        }}
      >
        <Component
          ref={ref}
          aria-label="Control"
          render={(props) => {
            outer()
            return <NativeFocusView {...props} />
          }}
          customButtonProps={{
            onPress: pressed,
            render: (props, state) => {
              inner(props, state)
              return <NativeFocusView {...props} nativeID="late-renderer" />
            },
          }}
        />
      </NativeCarouselControlsContext.Provider>,
    )
    const original = ref.current
    expect(original).not.toBeNull()
    expect(inner).toHaveBeenCalled()
    expect(outer).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Control" }).props.nativeID).toBe("late-renderer")
    await userEvent.setup().press(screen.getByRole("button", { name: "Control" }))
    expect(pressed).toHaveBeenCalledTimes(1)
    expect(ref.current).toBe(original)
    await view.unmount()
    expect(ref.current).toBeNull()
  },
)
