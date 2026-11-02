import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { NativeFocusView } from "../../.."
import { NativeComboBoxContext } from "../../ComboBox/collectionContext"
import { TagComboBox } from "../TagComboBox"

const items = [{ key: 0, label: "Zero" }]
const base = {
  selectedItems: items,
  items,
  getItemKey: (item: (typeof items)[number]) => item.key,
  getItemTextValue: (item: (typeof items)[number]) => item.label,
  onSelectedItemsChange: () => {},
}
export const prototype = (
  <TagComboBox
    {...base}
    ref={createRef<View>()}
    inputRef={createRef<TextInput>()}
    onSelectedItemsChange={(next, details) => {
      next[0]?.key.toFixed()
      details.changedKeys[0]?.toString()
    }}
  >
    {(item) => item.label}
  </TagComboBox>
)
// @ts-expect-error Selection ownership belongs to selectedItems.
export const ownedValue = <TagComboBox {...base} value={null} />
// @ts-expect-error Native roots retain actual View refs.
export const domRef = <TagComboBox {...base} ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Nested ComboBox props cannot replace the owned selection callback.
export const nestedOwner = <TagComboBox {...base} customComboBoxProps={{ onChange: () => {} }} />
// @ts-expect-error Root/list state composition belongs to the private receiver.
export const privateItems = <TagComboBox {...base} controlledItems={items} />
// @ts-expect-error Nested customization cannot replace private collection admission.
export const nestedPrivateItems = <TagComboBox {...base} customComboBoxProps={{ controlledItems: items }} />
// @ts-expect-error The wrapper owns its native composition renderer.
export const privateRenderer = <TagComboBox {...base} renderContent={() => null} />
// @ts-expect-error Nested customization cannot replace wrapper popup ownership.
export const privatePopup = <TagComboBox {...base} customComboBoxProps={{ popoverIsOpen: true }} />

export const parentContracts = (
  <NativeComboBoxContext.Provider
    value={{ items: items.values(), isRequired: true, validationBehavior: "native", name: "entry" }}
  >
    <TagComboBox
      {...base}
      isRequired
      isInvalid={false}
      name="entry"
      allowsCustomValue
      menuTrigger="manual"
      validationBehavior="aria"
      validate={({ inputValue, value, selectedKey }) =>
        inputValue.length && value === selectedKey ? null : "Choose a value"
      }
      onFocus={(event) => event.nativeEvent.target.toFixed()}
      onFocusChange={(focused) => focused.valueOf()}
      customComboBoxProps={{
        style: (state) => ({ opacity: state.isRequired && state.isReadOnly && !state.isInvalid ? 0.5 : 1 }),
      }}
    />
  </NativeComboBoxContext.Provider>
)

export const customPickerRoot = (
  <TagComboBox
    {...base}
    id="field"
    aria-label="Field"
    render={(props, state) => (
      <NativeFocusView
        {...props}
        accessibilityHint={state.isRequired ? "Required" : state.isInvalid ? "Invalid" : "Ready"}
      />
    )}
  />
)
export const domPickerRoot = (
  // @ts-expect-error Custom picker roots retain original native View refs.
  <TagComboBox {...base} render={(props) => <NativeFocusView {...props} ref={createRef<HTMLElement>()} />} />
)

export const explicitOwnedTypography = (
  <TagComboBox
    {...base}
    selectedItems={items as readonly (typeof items)[number][]}
    customStyles={[{ fontStyle: "italic", letterSpacing: 3 }, { letterSpacing: 0 }]}
    customTagGroupStyles={{ fontStyle: "normal" }}
    customTagProps={{ customStyles: { fontStyle: "italic", letterSpacing: 5 } }}
    render={(native, state) => {
      const flags: boolean[] = [state.isOpen, state.isDisabled, state.isReadOnly, state.isRequired, state.isInvalid]
      return <NativeFocusView {...native} accessibilityHint={flags.some(Boolean) ? "Active" : "Idle"} />
    }}
  />
)
// @ts-expect-error Caller group customization cannot replace wrapper-owned removal behavior.
export const foreignGroupRemoval = <TagComboBox {...base} customTagGroupProps={{ onRemove: () => {} }} />
// @ts-expect-error Item identity belongs to getItemKey, not nested visual customization.
export const foreignTagIdentity = <TagComboBox {...base} customTagProps={{ id: "replacement" }} />
// @ts-expect-error CSS class strings do not replace explicit native style owners.
export const browserRootClass = <TagComboBox {...base} className="browser-only" />

export const sourceSinglePicker = (
  <TagComboBox {...base} selectionMode="single" customComboBoxProps={{ selectionMode: "single" }} />
)
// @ts-expect-error The selected tag array is multi-valued, but its inner picker keeps the source single-key contract.
export const foreignPickerSelectionMode = <TagComboBox {...base} selectionMode="multiple" />
// @ts-expect-error Nested picker customization retains the same single-key contract.
export const nestedMultiplePicker = <TagComboBox {...base} customComboBoxProps={{ selectionMode: "multiple" }} />
// @ts-expect-error Item authoring belongs to outer children rather than an ignored nested scaffold prop.
export const nestedItemScaffold = <TagComboBox {...base} customComboBoxProps={{ children: "Ignored replacement" }} />
