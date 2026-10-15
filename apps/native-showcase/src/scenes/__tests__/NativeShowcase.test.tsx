import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const renderShowcase = async () =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )

it("composes NumberInput locale/draft/commit/step fixtures and preserves state across theme/window changes", async () => {
  await renderShowcase()
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("NumberInput scene")
  expect(screen.getByTestId("number-intl-state")).toHaveTextContent(
    "Intl locales: en-US, fr-CA, fr-FR. Explicit numbering system: arab.",
  )
  const input = screen.getByTestId("number-fraction-input")
  await fireEvent.changeText(input, "0.25")
  expect(screen.getByTestId("number-state")).toHaveTextContent(/Value: 0.2.*Raw: 0.25.*Changes: 0/)
  await fireEvent(input, "submitEditing", { nativeEvent: { text: "0.25" } })
  await fireEvent(input, "endEditing", { nativeEvent: { text: "0.25" } })
  expect(screen.getByTestId("number-state")).toHaveTextContent(/Value: 0.3.*Changes: 1/)
  await press("Next page number")
  const french = screen.getByTestId("number-french-input")
  await fireEvent.changeText(french, "2\u00a0345,75")
  await fireEvent(french, "endEditing", { nativeEvent: { text: "2\u00a0345,75" } })
  expect(french).toHaveDisplayValue("2\u00a0345,75")
  await press("Toggle number locale")
  expect(french).toHaveDisplayValue("2\u202f345,75")
  await press("Dark theme")
  await press("Vertical blocked region")
  await press("Toggle number styles")
  expect(screen.getByTestId("number-state")).toHaveTextContent(/Value: 0.3.*Page: 1.*French: 2345.75/)
  expect(screen.getByTestId("number-fraction-input")).toHaveStyle({ fontSize: 18 })
  expect(screen.getByRole("button", { name: "Commit number and dismiss keyboard" })).toBeOnTheScreen()
  await press("Reset scene")
  await press("NumberInput scene")
  expect(screen.getByTestId("number-state")).toHaveTextContent(
    /Value: 0.2.*Raw: empty.*Changes: 0.*Page: empty.*French: 1234.5.*enabled.*echoes.*fr-CA/,
  )
})

it("exercises NumberInput declined commits, guards, configuration and bounded actions", async () => {
  await renderShowcase()
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("NumberInput scene")
  await press("Toggle number parent echo")
  const input = screen.getByTestId("number-fraction-input")
  await fireEvent.changeText(input, "3.4")
  await fireEvent(input, "endEditing", { nativeEvent: { text: "3.4" } })
  expect(input).toHaveDisplayValue("0.2")
  expect(screen.getByTestId("number-state")).toHaveTextContent(/Changes: 1.*declines/)
  await press("Toggle number read-only")
  await press("Increase fractional quantity")
  expect(screen.getByTestId("number-state")).toHaveTextContent(/Changes: 1.*read-only/)
  expect(screen.getByTestId("number-fraction-increment")).not.toBeDisabled()
  await press("Toggle number read-only")
  await press("Toggle number disabled")
  expect(screen.getByTestId("number-fraction-increment")).toBeDisabled()
  await press("Toggle number disabled")
  await press("Toggle number precision")
  await press("Next number geometry")
  const bounded = screen.getByTestId("number-bounded-input")
  await fireEvent.changeText(bounded, "0.475")
  await fireEvent(bounded, "endEditing", { nativeEvent: { text: "0.475" } })
  expect(bounded).toHaveDisplayValue("0.6")
  await press("Increase bounded quantity")
  expect(bounded).toHaveDisplayValue("0.85")
  expect(screen.getByTestId("number-bounded-increment")).toBeDisabled()
  await press("Clear controlled number")
  expect(input).toHaveDisplayValue("")
  expect(screen.getByTestId("number-footer")).toHaveTextContent(/iPhone signing remains deferred/)
})

it("composes public theme exports, fixture controls and reset without resetting actions on theme/layout changes", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  await user.press(screen.getByRole("button", { name: "Increment scene action" }))
  await user.press(screen.getByRole("button", { name: "Dark theme" }))
  expect(screen.getByTestId("theme-preview")).toHaveTextContent("Active theme: dark. Action count: 1.")
  await user.press(screen.getByRole("button", { name: "Toggle customization" }))
  expect(screen.getByTestId("theme-preview")).toHaveStyle({ color: "#087f8c", fontSize: 18 })
  await user.press(screen.getByRole("button", { name: "Vertical blocked region" }))
  expect(screen.getByText("Simulated geometry; no hardware posture events.")).toBeOnTheScreen()
  expect(screen.getByTestId("theme-preview")).toHaveTextContent(/Action count: 1\./)
  await user.press(screen.getByRole("button", { name: "Reset scene" }))
  expect(screen.getByTestId("theme-preview")).toHaveTextContent("Active theme: light. Action count: 0.")
  expect(screen.getByTestId("theme-preview")).toHaveStyle({ color: "#171717", fontSize: 14 })
  expect(screen.queryByText("Simulated geometry; no hardware posture events.")).not.toBeOnTheScreen()
})

it("updates live window metadata while preserving scene state", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  const user = userEvent.setup()
  await renderShowcase()
  await user.press(screen.getByRole("button", { name: "Increment scene action" }))
  try {
    await act(async () => {
      Dimensions.set({ window: { width: 900, height: 500, scale: 2, fontScale: 1.5 }, screen: previous.screen })
    })
    expect(screen.getByText(/Window 900 × 500 · font scale 1.5/)).toBeOnTheScreen()
    expect(screen.getByTestId("theme-preview")).toHaveTextContent(/Action count: 1\./)
  } finally {
    await act(async () => {
      Dimensions.set(previous)
    })
  }
})

it("composes library controls, blocks disabled/pending activation and resets scene defaults", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  await press("Library action")
  await press("Toggle library disabled")
  await press("Library action")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1.*State: disabled/)
  await press("Toggle library disabled")
  await press("Toggle library pending")
  expect(screen.getByTestId("library-button").props.accessibilityState).toMatchObject({ busy: true, disabled: false })
  await press("Library action")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await press("Toggle library pending")
  await press("Next button order")
  await press("Toggle button outline")
  await press("Toggle library styles")
  await press("Toggle render children")
  expect(screen.getByText("Rendered library action 1")).toHaveStyle({ color: "#ffffff" })
  expect(screen.getByTestId("library-button")).toHaveStyle({ backgroundColor: "#123456" })
  await press("Dark theme")
  await press("Vertical blocked region")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1.*secondary.*outline/)
  await press("Toggle constrained target")
  expect(screen.getByRole("button", { name: "Constrained library action" })).toHaveStyle({ width: 24, height: 24 })
  await press("Reset scene")
  expect(screen.getByTestId("theme-preview")).toHaveTextContent(/light.*count: 0/)
  await press("Text/Button scene")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0.*primary.*fill.*enabled/)
  expect(screen.queryByText(/Rendered library action/)).toBeNull()
  expect(screen.queryByRole("button", { name: "Constrained library action" })).toBeNull()
})

it("renders mixed and callback phrases with valid shadow styles and stable activation labels", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  expect(screen.getByText("Library action 0")).toBeOnTheScreen()
  await press("Library action")
  expect(screen.getByText("Library action 1")).toBeOnTheScreen()
  await press("Toggle library styles")
  expect(screen.getByText("Library action 1")).toHaveStyle({ color: "#ffffff" })
  await press("Toggle render children")
  expect(screen.getByText("Rendered library action 1")).toHaveStyle({ color: "#ffffff" })
  await press("Library action")
  expect(screen.getByText("Rendered library action 2")).toBeOnTheScreen()
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 2/)
})

it("retains library actions during live window changes", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  const user = userEvent.setup()
  await renderShowcase()
  await user.press(screen.getByRole("button", { name: "Text/Button scene" }))
  await user.press(screen.getByRole("button", { name: "Library action" }))
  try {
    await act(async () =>
      Dimensions.set({ window: { width: 844, height: 390, scale: 3, fontScale: 2 }, screen: previous.screen }),
    )
    expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
    expect(screen.getByText(/Window 844 × 390 · font scale 2/)).toBeOnTheScreen()
  } finally {
    await act(async () => Dimensions.set(previous))
  }
})

it("composes basic controls, mixed/group selection, text entry and blocked changes", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Basic controls scene")
  await user.press(screen.getByRole("switch", { name: "Controlled switch" }))
  await user.press(screen.getByRole("checkbox", { name: "Controlled checkbox" }))
  await user.press(screen.getByRole("checkbox", { name: "Group first" }))
  await user.press(screen.getByRole("checkbox", { name: "Group second" }))
  await user.type(screen.getByTestId("basic-input"), "Bonjour", { skipBlur: true })
  await fireEvent(screen.getByTestId("basic-input"), "submitEditing", { nativeEvent: { text: "Bonjour" } })
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(
    /Switch: on.*Checkbox: on.*Group: first,second.*Input: Bonjour.*Submits: 1/,
  )
  await press("Toggle mixed display")
  expect(screen.getByRole("checkbox", { name: "Controlled checkbox" }).props.accessibilityState.checked).toBe("mixed")
  await press("Toggle controls disabled")
  await user.press(screen.getByRole("switch", { name: "Controlled switch" }))
  await user.press(screen.getByRole("checkbox", { name: "Group first" }))
  await fireEvent.changeText(screen.getByTestId("basic-input"), "Changed")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(
    /Switch: on.*Group: first,second.*Input: Bonjour.*State: disabled/,
  )
  await press("Toggle controls disabled")
  await press("Toggle controls read-only")
  await user.press(screen.getByRole("checkbox", { name: "Controlled checkbox" }))
  await fireEvent.changeText(screen.getByTestId("basic-input"), "Changed")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Checkbox: on.*Input: Bonjour.*State: read-only/)
})

it("preserves basic-control state across themes, fixtures and live dimensions and resets it explicitly", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Basic controls scene")
  await user.press(screen.getByRole("switch", { name: "Uncontrolled switch" }))
  await user.press(screen.getByRole("checkbox", { name: "Group first" }))
  await press("Toggle control styles")
  await press("Next control order")
  await press("Next control geometry")
  await press("Dark theme")
  await press("Vertical blocked region")
  expect(screen.getByTestId("basic-switch-track", { includeHiddenElements: true })).toHaveStyle({
    width: 60,
    height: 24,
    backgroundColor: "#123456",
  })
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Group: first/)
  expect(screen.getByText(/Order: secondary.*Geometry: round.*Uncontrolled switch: on/)).toBeOnTheScreen()
  try {
    await act(async () =>
      Dimensions.set({ window: { width: 844, height: 390, scale: 3, fontScale: 2 }, screen: previous.screen }),
    )
    expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Group: first/)
    await press("Reset scene")
    await press("Basic controls scene")
    expect(screen.getByTestId("basic-control-state")).toHaveTextContent(
      /Switch: off.*Checkbox: off.*Group: none.*Input: empty.*Submits: 0.*State: enabled.*Mixed: no/,
    )
    expect(screen.getByRole("switch", { name: "Uncontrolled switch" }).props.accessibilityState.checked).toBe(false)
  } finally {
    await act(async () => Dimensions.set(previous))
  }
})

it("uses native submitted text when the final edit precedes a rendered controlled value", async () => {
  await renderShowcase()
  await userEvent.setup().press(screen.getByRole("button", { name: "Basic controls scene" }))
  await fireEvent.changeText(screen.getByTestId("basic-input"), "B")
  await fireEvent(screen.getByTestId("basic-input"), "submitEditing", { nativeEvent: { text: "Bonjour" } })
  expect(screen.getByTestId("basic-input")).toHaveDisplayValue("Bonjour")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Input: Bonjour.*Submits: 1/)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Compare core input" }))
  expect(screen.getByTestId("basic-input")).toHaveDisplayValue("Bonjour")
  await fireEvent.changeText(screen.getByTestId("basic-input"), "Salut")
  await user.press(screen.getByRole("button", { name: "Compare core input" }))
  expect(screen.getByTestId("basic-input")).toHaveDisplayValue("Salut")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Input: Salut.*Submits: 1/)
})

it("composes controlled and uncontrolled Select flows and blocks disabled/read-only changes", async () => {
  await renderShowcase()
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Select scene")
  await press("Showcase choice")
  await user.press(screen.getByRole("radio", { name: "String zero" }))
  expect(screen.getByTestId("select-state")).toHaveTextContent(/Value: string:0.*Changes: 1.*Open: no.*Open events: 2/)
  await press("Showcase choice")
  await press("Close choices")
  expect(screen.getByTestId("select-state")).toHaveTextContent(/Changes: 1.*Open events: 4/)
  await press("Toggle Select disabled")
  await press("Showcase choice")
  expect(screen.queryByRole("button", { name: "Close choices" })).toBeNull()
  await press("Toggle Select disabled")
  await press("Toggle Select read-only")
  await press("Showcase choice")
  await user.press(screen.getByRole("radio", { name: "Numeric zero" }))
  await press("Close choices")
  expect(screen.getByTestId("select-state")).toHaveTextContent(/Value: string:0.*Changes: 1.*read-only/)
  await press("Toggle Select read-only")
  await press("Uncontrolled choice")
  await user.press(screen.getByRole("radio", { name: "String zero" }))
  expect(screen.getByTestId("select-state")).toHaveTextContent(/Value: string:0.*Uncontrolled: string:0/)
})

it("retains Select identity through removal, empty collections, themes and fixtures and resets explicitly", async () => {
  await renderShowcase()
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Select scene")
  await press("Showcase choice")
  await user.press(screen.getByRole("radio", { name: "Numeric zero" }))
  await press("Toggle selected item removal")
  expect(screen.getByRole("button", { name: "Showcase choice" }).props.accessibilityValue.text).toBe("Choose a value")
  expect(screen.getByTestId("select-state")).toHaveTextContent(/Value: number:0.*Changes: 1/)
  await press("Toggle selected item removal")
  expect(screen.getByRole("button", { name: "Showcase choice" }).props.accessibilityValue.text).toBe("Numeric zero")
  await press("Choose near-end value")
  await press("Next Select collection")
  await press("Showcase choice")
  expect(screen.getByText("No items remaining to select")).toBeOnTheScreen()
  await press("Close choices")
  await press("Dark theme")
  await press("Vertical blocked region")
  expect(screen.getByTestId("select-state")).toHaveTextContent(
    /Value: string:choice-198.*Changes: 1.*Collection: empty/,
  )
  await press("Reset scene")
  await press("Select scene")
  expect(screen.getByTestId("select-state")).toHaveTextContent(
    /Value: none.*Changes: 0.*Collection: short.*Uncontrolled: number:0/,
  )
})

it("uses custom Select visuals while preserving explicit row names and selected state", async () => {
  await renderShowcase()
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Select scene" }))
  await user.press(screen.getByRole("button", { name: "Toggle Select custom content" }))
  expect(screen.getByText("Picked none")).toBeOnTheScreen()
  await user.press(screen.getByRole("button", { name: "Showcase choice" }))
  await user.press(screen.getByRole("radio", { name: "Numeric zero" }))
  expect(screen.getByText("Picked Numeric zero")).toBeOnTheScreen()
  await user.press(screen.getByRole("button", { name: "Showcase choice" }))
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByText("Numeric zero ✓")).toBeOnTheScreen()
})

it("composes multiline editing, final native submit text and controlled/uncontrolled radio guards", async () => {
  await renderShowcase()
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Multiline/Radio scene")
  const notes = "Bonjour Montréal\nComplete second line"
  await user.type(screen.getByTestId("multiline-draft"), notes, { skipBlur: true })
  await fireEvent.changeText(screen.getByTestId("multiline-submit"), "B")
  await fireEvent(screen.getByTestId("multiline-submit"), "submitEditing", { nativeEvent: { text: "Bonjour final" } })
  await user.press(screen.getByRole("radio", { name: "Radio second" }))
  await user.press(screen.getByRole("radio", { name: "Radio second" }))
  await user.press(screen.getByRole("radio", { name: "Radio unavailable" }))
  await user.press(screen.getByRole("radio", { name: "Uncontrolled second" }))
  expect(screen.getByTestId("multiline-radio-state")).toHaveTextContent(
    /Draft: Bonjour Montréal Complete second line.*Submitted: Bonjour final.*Submits: 1.*Radio: second.*Changes: 1.*Uncontrolled: second/,
  )
  expect(screen.getByTestId("multiline-submit")).toHaveDisplayValue("Bonjour final")
  expect(screen.getByTestId("multiline-draft").props.submitBehavior).toBe("newline")
  expect(screen.getByTestId("multiline-long")).toHaveStyle({ height: 96 })
  expect(screen.getByTestId("multiline-long").props.defaultValue).toContain("Line 16:")
  for (const guard of ["disabled", "read-only"]) {
    await press(`Toggle multiline ${guard}`)
    await user.press(screen.getByRole("radio", { name: "Radio first" }))
    await fireEvent.changeText(screen.getByTestId("multiline-draft"), "Changed")
    expect(screen.getByTestId("multiline-radio-state")).toHaveTextContent(/Radio: second.*Changes: 1/)
    expect(screen.getByTestId("multiline-draft")).toHaveDisplayValue(notes)
    await press(`Toggle multiline ${guard}`)
  }
})

it("retains radio values through removal, themes, fixtures and rotation and resets all scene defaults", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  await renderShowcase()
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Multiline/Radio scene")
  await user.press(screen.getByRole("radio", { name: "Radio first" }))
  await press("Toggle selected radio removal")
  expect(screen.queryByRole("radio", { name: "Radio first" })).toBeNull()
  expect(screen.getByTestId("multiline-radio-state")).toHaveTextContent(/Radio: first.*Changes: 1/)
  await press("Toggle selected radio removal")
  expect(screen.getByRole("radio", { name: "Radio first" }).props.accessibilityState.checked).toBe(true)
  await press("Toggle radio orientation")
  await press("Toggle multiline styles")
  await press("Next radio geometry")
  await press("Next radio order")
  await press("Dark theme")
  await press("Vertical blocked region")
  expect(screen.getByTestId("multiline-radio-group")).toHaveStyle({ flexDirection: "row", gap: 16 })
  expect(screen.getByTestId("multiline-radio-first-shape", { includeHiddenElements: true })).toHaveStyle({
    width: 24,
    height: 24,
    borderRadius: 10000,
  })
  try {
    await act(() =>
      Dimensions.set({ window: { width: 844, height: 390, scale: 3, fontScale: 2 }, screen: previous.screen }),
    )
    expect(screen.getByTestId("multiline-radio-state")).toHaveTextContent(
      /Radio: first.*Changes: 1.*secondary.*round.*horizontal/,
    )
    await press("Clear radio value")
    expect(screen.getByRole("radio", { name: "Radio first" }).props.accessibilityState.checked).toBe(false)
    await press("Reset scene")
    await press("Multiline/Radio scene")
    expect(screen.getByTestId("multiline-radio-state")).toHaveTextContent(
      /Draft: empty.*Submits: 0.*Radio: none.*Changes: 0.*Uncontrolled: first.*enabled.*primary.*rounded.*vertical/,
    )
    expect(screen.getByTestId("multiline-uncontrolled-first").props.accessibilityState.checked).toBe(true)
  } finally {
    await act(() => Dimensions.set(previous))
  }
})
