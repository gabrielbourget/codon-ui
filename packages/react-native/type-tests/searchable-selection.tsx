import { createRef, type ReactElement, type RefAttributes } from "react"
import type { TextInput, View } from "react-native"

import {
  PlaceholderText,
  type TNativePlaceholderTextRef,
  type TNativeComboBoxProps,
  type TNativeComboBoxRef,
} from "../src"

// This executable declaration freezes the surface before the implementation pass.
declare const ComboBoxContract: <T>(
  props: TNativeComboBoxProps<T> & RefAttributes<TNativeComboBoxRef>,
) => ReactElement | null
export const ValidPlaceholder = (
  <PlaceholderText
    ref={createRef<TNativePlaceholderTextRef>()}
    align="center"
    aria-label="Empty"
    style={{ color: "tomato" }}
  >
    Choose
  </PlaceholderText>
)
// @ts-expect-error typography shorthand is sealed
export const InvalidPlaceholderVariant = <PlaceholderText variant="h1" />
// @ts-expect-error foreground shorthand is sealed; native styles retain Text precedence
export const InvalidPlaceholderColor = <PlaceholderText color="red" />
// @ts-expect-error weight shorthand is sealed
export const InvalidPlaceholderWeight = <PlaceholderText fontWeight="bold" />
// @ts-expect-error style shorthand is sealed
export const InvalidPlaceholderFontStyle = <PlaceholderText fontStyle="italic" />
// @ts-expect-error only the reviewed alignments are supported
export const InvalidPlaceholderAlign = <PlaceholderText align="right" />

const base: TNativeComboBoxProps<{ key: string | number; label: string }> = {
  items: [
    { key: 0, label: "Numeric zero" },
    { key: "0", label: "String zero" },
  ],
  getKey: (item) => item.key,
  getTextValue: (item) => item.label,
  accessibilityLabel: "Choose",
  inputLabel: "Search choices",
  closeLabel: "Close choices",
}
export const ValidComboBox = (
  <ComboBoxContract
    {...base}
    ref={createRef<View>()}
    inputRef={createRef<TextInput>()}
    value={null}
    defaultValue={0}
    inputValue=""
    defaultInputValue=""
    isOpen={false}
    defaultOpen
    onChange={(key) => {
      const selected: string | number | null = key
      return selected
    }}
    onInputChange={(text) => text.toUpperCase()}
    onOpenChange={(open) => !open}
    color="tomato"
    width="100%"
    customStyles={{ color: "blue" }}
    customInputStyles={{ fontSize: 21 }}
    customButtonStyles={{ color: "green" }}
    customInputButtonGroupStyles={{ borderWidth: 2 }}
    customOptionsListStyles={{ padding: 8 }}
    style={({ defaultStyle, isOpen }) => [defaultStyle, { opacity: isOpen ? 1 : 0.8 }]}
    inputProps={{
      onChange: (event) => event.nativeEvent.text,
      onSelectionChange: (event) => event.nativeEvent.selection,
    }}
    renderItem={(item, state) => <PlaceholderText>{state.isSelected ? item.label : "Other"}</PlaceholderText>}
  />
)
const accept = (_props: TNativeComboBoxProps<{ key: string | number; label: string }>) => undefined
// @ts-expect-error query name is required
accept({ items: [], getKey: () => 0, getTextValue: () => "One", accessibilityLabel: "Choose", closeLabel: "Close" })
// @ts-expect-error trigger name is required
accept({ items: [], getKey: () => 0, getTextValue: () => "One", inputLabel: "Search", closeLabel: "Close" })
// @ts-expect-error Close name is required
accept({ items: [], getKey: () => 0, getTextValue: () => "One", inputLabel: "Search", accessibilityLabel: "Choose" })
// @ts-expect-error single typed key, not multiple selection
accept({ ...base, value: [0] })
// @ts-expect-error nullable selection does not make query nullable
accept({ ...base, inputValue: null })
// @ts-expect-error declarative collection children are excluded
accept({ ...base, children: "Row" })
// @ts-expect-error caller supplies filtered/async items
accept({ ...base, defaultFilter: () => true })
// @ts-expect-error uncontrolled collection is excluded
accept({ ...base, defaultItems: [] })
// @ts-expect-error custom free-text committed selection is excluded
accept({ ...base, allowsCustomValue: true })
// @ts-expect-error obsolete selected-key alias is excluded
accept({ ...base, selectedKey: 0 })
// @ts-expect-error no anchored placement
accept({ ...base, placement: "bottom" })
// @ts-expect-error no web focus wrapping
accept({ ...base, shouldFocusWrap: true })
// @ts-expect-error no focus/input menu-trigger policy
accept({ ...base, menuTrigger: "focus" })
// @ts-expect-error no DOM class plumbing
accept({ ...base, className: "web" })
// @ts-expect-error no HTML forms
accept({ ...base, name: "choice" })
// @ts-expect-error no portal placement
accept({ ...base, portalContainer: {} })
// @ts-expect-error editor value is owned by inputValue
accept({ ...base, inputProps: { value: "shadow" } })
// @ts-expect-error editor change is owned by onInputChange
accept({ ...base, inputProps: { onChangeText: () => undefined } })
// @ts-expect-error editor label is owned by inputLabel
accept({ ...base, inputProps: { accessibilityLabel: "Other" } })
// @ts-expect-error editor identity is owned
accept({ ...base, inputProps: { testID: "Other" } })
// @ts-expect-error DOM refs are excluded
export const InvalidComboBoxRef = <ComboBoxContract {...base} ref={createRef<{ tagName: string }>()} />
// @ts-expect-error root View ref and input TextInput ref are distinct
export const InvalidComboBoxInputRef = <ComboBoxContract {...base} inputRef={createRef<View>()} />
