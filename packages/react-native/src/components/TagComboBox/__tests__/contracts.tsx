import { createRef } from "react"
import type { TextInput, View } from "react-native"

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
