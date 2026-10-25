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
