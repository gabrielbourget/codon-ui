import { createRef } from "react"
import { Pressable, View } from "react-native"

import { ListBoxItem, Select, type SelectProps, type TNativeListBoxItemRef, type TNativeSelectRef } from "../src"

const browserNodeRef = createRef<{ tagName: string }>()

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
// @ts-expect-error Rows retain their original native View ref.
export const InvalidRowRef = <ListBoxItem id="one" textValue="One" ref={browserNodeRef} />
// @ts-expect-error Select retains its original native View ref.
export const InvalidSelectRef = <Select {...ValidSelectProps} ref={browserNodeRef} />
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

export const RenderedRow = (
  <ListBoxItem
    id={0}
    textValue="Choice"
    customStyles={{ color: "#123456" }}
    style={({ defaultStyle }) => ({ ...defaultStyle, color: "#abcdef" })}
    render={(props, state) => <Pressable {...props} nativeID={String(state.isSelected)} />}
  >
    {({ defaultChildren, isSelected }) => defaultChildren ?? String(isSelected)}
  </ListBoxItem>
)
export const InvalidRowDOMRenderer = (
  // @ts-expect-error Row renderer receives native Pressable props and View ref.
  <ListBoxItem id={0} textValue="Choice" render={(_props: { ref: HTMLDivElement }) => <Pressable />} />
)
export const InvalidRowCollectionState = (
  <ListBoxItem
    id={0}
    textValue="Choice"
    render={(props, state) => {
      // @ts-expect-error The original standalone row has no React Aria collection/drag state.
      void state.selectionBehavior
      return <Pressable {...props} />
    }}
  />
)

export const RenderedSelect = (
  <Select
    {...ValidSelectProps}
    customStyles={{ color: "#123456" }}
    customSelectedItemStyles={{ color: "#abcdef" }}
    render={(props, state) => <View {...props} nativeID={String(state.isOpen)} />}
  />
)
export const InvalidSelectRootDOMRef = (
  // @ts-expect-error Native root rendering receives View props; public ref remains the native trigger.
  <Select {...ValidSelectProps} render={(_props: { ref: HTMLDivElement }) => <View />} />
)
export const InvalidSelectRootState = (
  <Select
    {...ValidSelectProps}
    render={(props, state) => {
      // @ts-expect-error Original native Select state has no React Stately object or required-form state.
      void state.state
      return <View {...props} />
    }}
  />
)
