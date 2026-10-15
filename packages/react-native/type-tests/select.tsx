import { createRef } from "react"

import { ListBoxItem, Select, type SelectProps, type TNativeListBoxItemRef, type TNativeSelectRef } from "../src"

export const ValidRow = (
  <ListBoxItem id={0} textValue="Choice" ref={createRef<TNativeListBoxItemRef>()} isSelected>
    {({ isSelected }) => <>Choice {isSelected ? 1 : 0}</>}
  </ListBoxItem>
)
export const ValidSelectProps: SelectProps<{ id: string; name: string }> = {
  items: [{ id: "first", name: "First" }],
  getKey: (item) => item.id,
  getTextValue: (item) => item.name,
  "aria-label": "Choose",
  closeLabel: "Close",
  value: null,
  width: "100%",
  style: ({ defaultStyle, isOpen }) => [defaultStyle, { opacity: isOpen ? 1 : 0.8 }],
}
export const ValidSelect = (
  <Select
    {...ValidSelectProps}
    ref={createRef<TNativeSelectRef>()}
    renderSelectedValue={({ selectedItem }) => selectedItem?.name}
  />
)
// @ts-expect-error anchored web placement is not the native modal contract
export const InvalidSelectPlacement = <Select {...ValidSelectProps} placement="bottom" />
// @ts-expect-error obsolete React Aria key aliases are excluded
export const InvalidSelectKeyAlias = <Select {...ValidSelectProps} selectedKey="first" />
// @ts-expect-error web keyboard wrapping is not a native contract
export const InvalidSelectWrap = <Select {...ValidSelectProps} shouldFocusWrap />
// @ts-expect-error row checked state is owned
export const InvalidRowChecked = <ListBoxItem id="one" textValue="One" aria-checked />
// @ts-expect-error row label comes from required text metadata
export const InvalidRowLabel = <ListBoxItem id="one" textValue="One" accessibilityLabel="Other" />
// @ts-expect-error metadata is required even when visual content is supplied
export const InvalidRowMetadata = <ListBoxItem id="one">One</ListBoxItem>
// @ts-expect-error explicit collection metadata replaces declarative children
export const InvalidSelectChildren: SelectProps<{ id: string; name: string }> = { ...ValidSelectProps, children: "Row" }
// @ts-expect-error Select requires an accessible name
export const InvalidSelectLabel: SelectProps<{ id: string; name: string }> = {
  items: [],
  getKey: () => 0,
  getTextValue: () => "Row",
  closeLabel: "Close",
}
// @ts-expect-error CSS lengths are not native dimensions
export const InvalidSelectWidth: SelectProps<{ id: string; name: string }> = { ...ValidSelectProps, width: "10px" }
