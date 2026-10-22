import "../../../collection/__tests__/nativeReceipts"

import { createRef, useState, type ReactNode } from "react"
import { StyleSheet, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { NativeCollectionComboBox } from "../CollectionComboBox"
import { NativeComboBoxItem } from "../ComboBoxItem"
import { NativeComboBoxHeader, NativeComboBoxSection } from "../ComboBoxSection"

const hidden = { includeHiddenElements: true }
const wrap = (children: ReactNode) => (
  <NativeThemeProvider>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost>{children}</NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("retains section/header original custom hosts and presentational group naming", async () => {
  const section = createRef<View>(),
    header = createRef<View>(),
    sectionValues: unknown[] = [],
    headerValues: unknown[] = []
  await render(
    wrap(
      <NativeCollectionComboBox
        items={[]}
        getKey={() => "unused"}
        getTextValue={() => "unused"}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
      >
        <NativeComboBoxSection
          id="metadata-section"
          accessibilityLabel="Fallback"
          ref={section}
          style={{ padding: 6 }}
          render={(props, values) => {
            sectionValues.push(values)
            return <NativeFocusHost {...props} testID="section" />
          }}
        >
          <NativeComboBoxHeader
            id="authored-heading"
            ref={header}
            style={{ color: "red" }}
            render={(props, values) => {
              headerValues.push(values)
              return <NativeFocusHost {...props} testID="heading" />
            }}
          >
            Choices
          </NativeComboBoxHeader>
          <NativeComboBoxItem id={0} textValue="Zero">
            Zero
          </NativeComboBoxItem>
        </NativeComboBoxSection>
      </NativeCollectionComboBox>,
    ),
  )
  const group = screen.getByTestId("section", hidden),
    heading = screen.getByTestId("heading", hidden)
  expect(section.current).not.toBeNull()
  expect(header.current).not.toBeNull()
  expect(group.props.id).toBeUndefined()
  expect(group.props.nativeLabelledBy).toEqual([heading.props.nativeID])
  expect(heading.props.nativeID).toBeTruthy()
  expect(heading.props.nativeID).not.toBe("authored-heading")
  expect(heading.props.id).toBeUndefined()
  expect(heading.props.role).toBe("presentation")
  expect(heading.props.focusable).toBe(false)
  expect(StyleSheet.flatten(group.props.style)).toMatchObject({ padding: 6 })
  expect(StyleSheet.flatten(screen.getByText("Choices", hidden).props.style)).toMatchObject({ color: "red" })
  expect(sectionValues.length).toBeGreaterThan(0)
  expect(sectionValues.every((value) => value === undefined)).toBe(true)
  expect(headerValues.length).toBeGreaterThan(0)
  expect(headerValues.every((value) => value === undefined)).toBe(true)
})

it("retires group header references on actual ID replacement and removal", async () => {
  let replace!: () => void, remove!: () => void
  const section = createRef<View>(),
    header = createRef<View>()
  const Harness = () => {
    const [phase, setPhase] = useState(0)
    replace = () => setPhase(1)
    remove = () => setPhase(2)
    return (
      <NativeCollectionComboBox
        items={[]}
        getKey={() => "unused"}
        getTextValue={() => "unused"}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
      >
        <NativeComboBoxSection id="section" accessibilityLabel="Fallback" ref={section} testID="section">
          {phase === 2 ? null : (
            <NativeComboBoxHeader key={phase} id={phase === 0 ? "before" : "after"} ref={header}>
              Choices
            </NativeComboBoxHeader>
          )}
          <NativeComboBoxItem id={0} textValue="Zero">
            Zero
          </NativeComboBoxItem>
        </NativeComboBoxSection>
      </NativeCollectionComboBox>
    )
  }
  await render(wrap(<Harness />))
  const original = header.current
  const generatedID = screen.getByTestId("section", hidden).props.nativeLabelledBy?.[0]
  expect(generatedID).toBeTruthy()
  await act(replace)
  expect(header.current).not.toBe(original)
  expect(header.current).not.toBeNull()
  expect(screen.getByTestId("section", hidden).props.nativeLabelledBy).toEqual([generatedID])
  await act(remove)
  expect(header.current).toBeNull()
  expect(screen.getByTestId("section", hidden).props.nativeLabelledBy).toBeUndefined()
  expect(screen.getByTestId("section", hidden).props.accessibilityLabel).toBe("Fallback")
})
