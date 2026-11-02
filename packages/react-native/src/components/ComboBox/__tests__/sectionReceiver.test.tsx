import { act, render, screen } from "@testing-library/react-native"
import { createRef, useState, type ReactNode } from "react"
import { StyleSheet, type View } from "react-native"

import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { NativeCollectionComboBox } from "../CollectionComboBox"
import { NativeComboBoxItem } from "../ComboBoxItem"
import { NativeComboBoxHeader, NativeComboBoxSection } from "../ComboBoxSection"

jest.mock("../../../input/specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

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
        collectionItems={[
          {
            key: "metadata-section",
            type: "section",
            value: null,
            rendered: "",
            textValue: "",
            props: {},
            render: () => (
              <NativeComboBoxSection
                accessibilityLabel="Fallback"
                ref={section}
                style={{ padding: 6 }}
                render={(props, values) => {
                  sectionValues.push(values)
                  return <NativeFocusHost {...props} testID="section" />
                }}
              />
            ),
            children: [
              {
                key: "authored-heading",
                type: "header",
                value: null,
                rendered: "Choices",
                textValue: "Choices",
                props: {},
                render: () => (
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
                ),
              },
              {
                key: 0,
                type: "item",
                value: null,
                rendered: "Zero",
                textValue: "Zero",
                props: {},
                render: () => <NativeComboBoxItem textValue="Zero">Zero</NativeComboBoxItem>,
              },
            ],
          },
        ]}
      />,
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
        collectionItems={[
          {
            key: "section",
            type: "section",
            value: null,
            rendered: "",
            textValue: "",
            props: {},
            render: () => <NativeComboBoxSection accessibilityLabel="Fallback" ref={section} testID="section" />,
            children: [
              ...(phase === 2
                ? []
                : [
                    {
                      key: "heading",
                      type: "header",
                      value: null,
                      rendered: "Choices",
                      textValue: "Choices",
                      props: {},
                      render: () => (
                        <NativeComboBoxHeader key={phase} id={phase === 0 ? "before" : "after"} ref={header}>
                          Choices
                        </NativeComboBoxHeader>
                      ),
                    },
                  ]),
              {
                key: 0,
                type: "item",
                value: null,
                rendered: "Zero",
                textValue: "Zero",
                props: {},
                render: () => <NativeComboBoxItem textValue="Zero">Zero</NativeComboBoxItem>,
              },
            ],
          },
        ]}
      />
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
