import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { FormField, Input, Text } from "../../.."

it("routes ordered native description relationships while preserving caller labels, hints and values", async () => {
  await render(
    <FormField
      accessibilityLabel="Context"
      accessibilityLabelledBy={["native-name", "second-name"]}
      ariaLabelledBy="alias-name"
      accessibilityHint="Authored hint"
      accessibilityValue={{ text: "", now: 0 }}
      ariaDescribedBy={" first\nsecond\tthird "}
      ariaDetails="details-one details-two"
      labels={{ descriptionLabel: "Description du champ", detailsLabel: "Renseignements" }}
    />,
  )
  expect(screen.getByTestId("form-field").props).toMatchObject({
    nativeLabelledBy: ["native-name", "second-name"],
    nativeDescribedBy: ["first", "second", "third"],
    nativeDetailsBy: ["details-one", "details-two"],
    nativeDescriptionLabel: "Description du champ",
    nativeDetailsLabel: "Renseignements",
    accessibilityLabel: "Context",
    accessibilityHint: "Authored hint",
    accessibilityValue: { text: "", now: 0 },
    focusable: false,
  })
})

it("gives explicit native ARIA strings precedence, including empty relationship lists and captions", async () => {
  await render(
    <FormField
      aria-describedby=""
      ariaDescribedBy="alias-description"
      aria-details=""
      ariaDetails="alias-details"
      aria-labelledby=""
      ariaLabelledBy="alias-name"
      labels={{ descriptionLabel: "", detailsLabel: "" }}
    />,
  )
  expect(screen.getByTestId("form-field").props).toMatchObject({
    nativeLabelledBy: [],
    nativeDescribedBy: [],
    nativeDetailsBy: [],
    nativeDescriptionLabel: "",
    nativeDetailsLabel: "",
  })
})

it("updates and removes relationships without replacing the actual root or child editor", async () => {
  const root = createRef<View>(),
    change = jest.fn()
  const fixture = (mode: number) => (
    <FormField
      ref={root}
      ariaDescribedBy={mode === 0 ? "old" : mode === 1 ? "new another" : undefined}
      ariaDetails={mode === 0 ? "details" : undefined}
    >
      <Input accessibilityLabel="Editor" value="" onChangeText={change} />
      <Text nativeID="new">Current description</Text>
    </FormField>
  )
  const view = await render(fixture(0)),
    originalRoot = root.current
  const editor = screen.getByLabelText("Editor")
  await fireEvent.changeText(editor, "request")
  await view.rerender(fixture(1))
  expect(root.current).toBe(originalRoot)
  expect(screen.getByLabelText("Editor")).toBe(editor)
  expect(screen.getByTestId("form-field").props.nativeDescribedBy).toEqual(["new", "another"])
  expect(screen.getByTestId("form-field").props.nativeDetailsBy).toBeUndefined()
  expect(screen.getByLabelText("Editor").props.value).toBe("")
  await view.rerender(fixture(2))
  expect(screen.getByTestId("form-field").props.nativeDescribedBy).toBeUndefined()
  expect(change.mock.calls).toEqual([["request"]])
})

it("preserves original bubbling focus and blur events and retires saved callbacks after unmount", async () => {
  const focus = jest.fn(),
    blur = jest.fn()
  const view = await render(<FormField onFocus={focus} onBlur={blur} />)
  const root = screen.getByTestId("form-field")
  const onFocus = root.props.onFocus,
    onBlur = root.props.onBlur
  const focused = { nativeEvent: { target: 7 } },
    blurred = { nativeEvent: { target: 8 } }
  await act(() => {
    onFocus(focused)
    onBlur(blurred)
  })
  expect(focus.mock.calls[0][0]).toBe(focused)
  expect(blur.mock.calls[0][0]).toBe(blurred)
  await view.unmount()
  await act(() => {
    onFocus(focused)
    onBlur(blurred)
  })
  expect(focus).toHaveBeenCalledTimes(1)
  expect(blur).toHaveBeenCalledTimes(1)
})

it("exposes the actual owned host ref with React19 cleanup and keeps authored focusability", async () => {
  const cleanup = jest.fn(),
    ref = jest.fn((target: View | null) => {
      expect(typeof target?.measure).toBe("function")
      return cleanup
    })
  const view = await render(<FormField ref={ref} focusable />)
  expect(screen.getByTestId("form-field").props.focusable).toBe(true)
  expect(typeof ref.mock.calls[0][0]?.measure).toBe("function")
  expect(typeof ref.mock.calls[0][0]?.setNativeProps).toBe("function")
  await view.unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
})

it("retains core View tabIndex precedence without making an ordinary field focusable", async () => {
  const view = await render(<FormField />)
  expect(screen.getByTestId("form-field").props.focusable).toBe(false)
  await view.rerender(<FormField focusable={false} tabIndex={0} />)
  expect(screen.getByTestId("form-field").props.focusable).toBe(true)
  await view.rerender(<FormField focusable tabIndex={-1} />)
  expect(screen.getByTestId("form-field").props.focusable).toBe(false)
})
