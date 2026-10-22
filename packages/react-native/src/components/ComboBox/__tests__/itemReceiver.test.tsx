import "../../../collection/__tests__/nativeReceipts"

import { createRef, useContext, useState, type ReactNode } from "react"
import { StyleSheet, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeSelectionIndicatorContext } from "../../../collection/context"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { nativeControlTarget } from "../../selection"
import type { TNativeTextRef } from "../../Text/types"
import { NativeCollectionComboBox } from "../CollectionComboBox"
import { NativeComboBoxStateContext } from "../collectionContext"
import { NativeComboBoxItem } from "../ComboBoxItem"
import { NativeComboBoxText } from "../fieldParts"

const hidden = { includeHiddenElements: true }
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const wrap = (children: ReactNode) => (
  <NativeThemeProvider overrides={{ typography: { fontSizes: { b9: 21, b10: 17, b11: 13 } } }}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="window">{children}</NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)

it("retains complete item render/style flags, actual custom host and original text slot bindings", async () => {
  const original = createRef<View>(),
    label = createRef<TNativeTextRef>(),
    description = createRef<TNativeTextRef>()
  let flags: Record<string, unknown> = {},
    renderFlags: Record<string, unknown> = {},
    styleFlags: Record<string, unknown> = {},
    indicator: unknown
  const Capture = () => {
    indicator = useContext(NativeSelectionIndicatorContext)
    return null
  }
  await render(
    wrap(
      <NativeCollectionComboBox
        items={[{ id: 0, label: "Zero" }]}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        isOpen
        value={null}
        inputValue=""
        inputLabel="Query"
        closeLabel="Close"
        color="#aa0011"
        customOptionsListStyles={{ color: "#aa0011", padding: 6 }}
      >
        {(item) => (
          <NativeComboBoxItem
            id={item.id}
            textValue={item.label}
            ref={original}
            textSize="large"
            customStyles={{ padding: 9 }}
            style={(values) => {
              styleFlags = values
              return { marginTop: 3, color: "#008844" }
            }}
            render={(props, values) => {
              renderFlags = values
              return <NativeFocusHost {...props} testID="rendered-item" />
            }}
          >
            {(values) => {
              flags = values
              return (
                <>
                  <Capture />
                  <NativeComboBoxText ref={label} slot="label" nativeID="current-label" testID="label">
                    Zero
                  </NativeComboBoxText>
                  <NativeComboBoxText ref={description} slot="description" testID="description">
                    Detail
                  </NativeComboBoxText>
                </>
              )
            }}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  const host = screen.getByTestId("rendered-item", hidden)
  const expected = {
    isSelected: false,
    isDisabled: false,
    isHovered: false,
    isPressed: false,
    allowsSelection: true,
    hasAction: false,
    allowsDragging: false,
    selectionMode: "single",
    selectionBehavior: "toggle",
  }
  for (const values of [flags, renderFlags, styleFlags]) {
    expect(values).toMatchObject(expected)
    expect(values).toHaveProperty("isDragging")
    expect(values).toHaveProperty("isDropTarget")
  }
  expect(original.current).not.toBeNull()
  expect(label.current).not.toBeNull()
  expect(description.current).not.toBeNull()
  expect(StyleSheet.flatten(host.props.style)).toMatchObject({
    padding: 9,
    marginTop: 3,
    width: "100%",
    minHeight: nativeControlTarget(),
    backgroundColor: "transparent",
  })
  expect(styleFlags.defaultStyle).toMatchObject({ padding: 9, fontSize: 21, color: "#aa0011" })
  expect(StyleSheet.flatten(screen.getByTestId("combo-box-list", hidden).props.style)).toMatchObject({ padding: 6 })
  expect(host.props.nativeLabelledBy).toEqual(["current-label"])
  expect(host.props.nativeDescribedBy).toEqual([screen.getByTestId("description", hidden).props.nativeID])
  expect(indicator).toEqual({ isSelected: false })
  expect(StyleSheet.flatten(screen.getByTestId("label", hidden).props.style)).toMatchObject({
    fontSize: 21,
    color: "#008844",
  })
})

it.each([
  ["small", 13],
  ["medium", 17],
  ["large", 21],
] as const)("receives owned textSize %s through the native typography role", async (textSize, size) => {
  await render(
    wrap(
      <NativeCollectionComboBox
        items={[{ id: 0, label: "Zero" }]}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
      >
        {(item) => (
          <NativeComboBoxItem id={item.id} textValue={item.label} textSize={textSize}>
            {item.label}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  expect(StyleSheet.flatten(screen.getByText("Zero", hidden).props.style).fontSize).toBe(size)
})

it("retires an authored disabled focused item without replacing its original host", async () => {
  let disable!: () => void, state!: NonNullable<React.ContextType<typeof NativeComboBoxStateContext>>
  const original = createRef<View>()
  const Capture = () => {
    state = useContext(NativeComboBoxStateContext)!
    return null
  }
  const Harness = () => {
    const [disabled, setDisabled] = useState(false)
    disable = () => setDisabled(true)
    return (
      <NativeCollectionComboBox
        items={[{ id: 0, label: "Zero", disabled }]}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
      >
        {(item) => (
          <NativeComboBoxItem id={item.id} textValue={item.label} isDisabled={item.disabled} ref={original}>
            <Capture />
            {item.label}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>
    )
  }
  await render(wrap(<Harness />))
  const host = original.current
  await act(() => {
    state.selectionManager.setFocused(true)
    state.selectionManager.setFocusedKey(0)
  })
  expect(state.selectionManager.focusedKey).toBe(0)
  await act(disable)
  expect(state.selectionManager.focusedKey).toBeNull()
  expect(original.current).toBe(host)
})

it.each([null, false, 0, "", undefined])(
  "keeps explicit item content separate from searchable text: %s",
  async (children) => {
    await render(
      wrap(
        <NativeCollectionComboBox
          items={[{ id: 0 }]}
          getKey={(item) => item.id}
          getTextValue={() => "Search text"}
          isOpen
          inputLabel="Query"
          closeLabel="Close"
        >
          {(item) => (
            <NativeComboBoxItem id={item.id} textValue="Search text">
              {children}
            </NativeComboBoxItem>
          )}
        </NativeCollectionComboBox>,
      ),
    )
    expect(screen.queryByText("Search text", hidden)).toBeNull()
    expect(screen.queryByText("0", hidden) === null).toBe(children !== 0)
  },
)

it("retires text slot IDs while retaining inherited text styles and explicit typography overrides", async () => {
  let change!: () => void
  const label = createRef<TNativeTextRef>(),
    description = createRef<TNativeTextRef>()
  const Harness = () => {
    const [retired, setRetired] = useState(false)
    change = () => setRetired(true)
    return (
      <NativeCollectionComboBox
        items={[{ id: 0, label: "Zero" }]}
        getKey={(item) => item.id}
        getTextValue={(item) => item.label}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
      >
        {(item) => (
          <NativeComboBoxItem
            id={item.id}
            textValue={item.label}
            textSize="large"
            testID="slot-option"
            customStyles={{ color: "#008844", fontSize: 27 }}
          >
            <NativeComboBoxText
              slot={retired ? null : "label"}
              nativeID={retired ? "replacement" : "original"}
              ref={label}
              testID="slot-label"
            >
              Zero
            </NativeComboBoxText>
            <NativeComboBoxText slot={null} variant="b11" fontWeight="bold" color="#aa0011" testID="own-role">
              Own
            </NativeComboBoxText>
            {retired ? null : (
              <NativeComboBoxText slot="description" ref={description} testID="slot-description">
                Detail
              </NativeComboBoxText>
            )}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>
    )
  }
  await render(wrap(<Harness />))
  const original = label.current
  expect(screen.getByTestId("slot-option", hidden).props.nativeLabelledBy).toEqual(["original"])
  expect(StyleSheet.flatten(screen.getByTestId("slot-label", hidden).props.style)).toMatchObject({
    fontSize: 27,
    color: "#008844",
  })
  expect(StyleSheet.flatten(screen.getByTestId("own-role", hidden).props.style)).toMatchObject({
    fontSize: 13,
    fontWeight: "700",
    color: "#aa0011",
  })
  await act(change)
  expect(label.current).toBe(original)
  expect(description.current).toBeNull()
  expect(screen.getByTestId("slot-label", hidden).props.nativeID).toBe("replacement")
  expect(screen.getByTestId("slot-option", hidden).props.nativeLabelledBy).toBeUndefined()
  expect(screen.getByTestId("slot-option", hidden).props.nativeDescribedBy).toBeUndefined()
  expect(StyleSheet.flatten(screen.getByTestId("slot-label", hidden).props.style)).toMatchObject({
    fontSize: 27,
    color: "#008844",
  })
})

it("clears authored overrides back to item-owned defaults without losing zero values", async () => {
  await render(
    wrap(
      <NativeCollectionComboBox
        items={[{ id: 0 }]}
        getKey={(item) => item.id}
        getTextValue={() => "Zero"}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
      >
        {(item) => (
          <NativeComboBoxItem
            id={item.id}
            textValue="Zero"
            textSize="large"
            testID="cleared-item"
            customStyles={{ padding: 9, fontSize: 99, marginTop: 7 }}
            style={{ padding: undefined, fontSize: undefined, marginTop: 0 }}
          >
            <NativeComboBoxText
              slot={null}
              testID="cleared-text"
              customStyles={{ fontSize: 88 }}
              style={{ fontSize: undefined }}
            >
              Zero
            </NativeComboBoxText>
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  expect(StyleSheet.flatten(screen.getByTestId("cleared-item", hidden).props.style)).toMatchObject({
    padding: 5,
    marginTop: 0,
    minHeight: nativeControlTarget(),
  })
  expect(StyleSheet.flatten(screen.getByTestId("cleared-text", hidden).props.style).fontSize).toBe(21)
})
