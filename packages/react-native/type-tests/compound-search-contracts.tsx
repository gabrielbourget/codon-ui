import { createRef } from "react"
import type { TextInput, View } from "react-native"

import {
  CompactTypeaheadSearch,
  TagComboBox,
  TagComboBoxItem,
  NativeComboBoxContext,
  NativeComboBoxInputContext,
  NativeComboBoxPopoverContext,
  useNativeContextProps,
  NativeForm,
  NativeFormAction,
  submitNativeForm,
  resetNativeForm,
  resolveCompactTypeaheadSearchLabels,
  AVAILABLE_TYPE_AHEAD_SEARCH_SIZES,
  type CompactTypeaheadSearchProps,
  type CompactTypeaheadSearchRenderItemArgs,
  type PartialCompactTypeaheadSearchStatusLabels,
  type TagComboBoxProps,
  type TagComboBoxChangeDetails,
  type TNativeComboBoxKeyboardEvent,
} from "../src"

type TItem = { id: string | number; name: string }
const items: TItem[] = [
  { id: 0, name: "Numeric zero" },
  { id: "0", name: "String zero" },
]
const original = createRef<TextInput>()
const form = createRef<View>()
const key = (event: TNativeComboBoxKeyboardEvent) => {
  const input: TextInput = event.currentTarget
  const composing: boolean = event.nativeEvent.isComposing
  if (!composing && event.nativeEvent.key === "Escape") event.preventDefault()
  void input
}
const compact: CompactTypeaheadSearchProps<TItem> = {
  items,
  getItemKey: (item) => item.id,
  getItemTextValue: (item) => item.name,
  inputValue: "",
  value: null,
  onKeyDown: key,
  onKeyUp: key,
  inputProps: { onKeyUp: key },
  renderItem: (item, args: CompactTypeaheadSearchRenderItemArgs) => `${item.name}:${args.itemKey}:${args.query}`,
  name: "query",
  formValue: "text",
  validationBehavior: "aria",
  validate: ({ inputValue }) => (inputValue ? null : "Enter a query"),
  style: ({ defaultStyle, isInvalid }) => [defaultStyle, { opacity: isInvalid ? 0.5 : 1 }],
}
const selection = (_next: TItem[], details: TagComboBoxChangeDetails<TItem>) => details.changedItems[0]?.name
const tags: TagComboBoxProps<TItem> = {
  items,
  selectedItems: [],
  getItemKey: (item) => item.id,
  getItemTextValue: (item) => item.name,
  onSelectedItemsChange: selection,
  onKeyDown: key,
  customComboBoxProps: { onKeyUp: key, formValue: "text" },
  customTagProps: { isDisabled: false },
  children: (item) => (
    <TagComboBoxItem id={item.id} textValue={item.name}>
      {item.name}
    </TagComboBoxItem>
  ),
}
export const Fields = (
  <NativeForm ref={form} id="search-form" onSubmit={(request) => request.preventDefault()}>
    <NativeComboBoxContext.Provider value={{ isReadOnly: true }}>
      <NativeComboBoxInputContext.Provider value={{ onKeyDown: key }}>
        <CompactTypeaheadSearch {...compact} ref={createRef<View>()} inputRef={original} />
        <TagComboBox {...tags} inputRef={original} />
      </NativeComboBoxInputContext.Provider>
    </NativeComboBoxContext.Provider>
    <NativeFormAction action="submit">Submit</NativeFormAction>
    <NativeFormAction action="reset">Reset</NativeFormAction>
  </NativeForm>
)
export const FormActions = async () => {
  if (!form.current) return
  await submitNativeForm(form.current)
  await resetNativeForm(form.current)
}
export const Labels = resolveCompactTypeaheadSearchLabels()
export const Status: PartialCompactTypeaheadSearchStatusLabels = { loadingMessage: "Searching" }
export const Sizes = AVAILABLE_TYPE_AHEAD_SEARCH_SIZES
export const PublicPopoverBridge = () => {
  const [props, ref] = useNativeContextProps({ slot: "popup" }, createRef<View>(), NativeComboBoxPopoverContext)
  return (
    <NativeComboBoxPopoverContext.Provider value={{ ...props, ref }}>{Fields}</NativeComboBoxPopoverContext.Provider>
  )
}
// @ts-expect-error Native slot names remain strings/null at the public receiver boundary.
export const InvalidSlot = () => useNativeContextProps({ slot: 0 }, undefined, NativeComboBoxPopoverContext)
export const InvalidContextRef = () =>
  useNativeContextProps(
    {},
    createRef<HTMLDivElement>(),
    // @ts-expect-error Context refs retain their actual native host type.
    NativeComboBoxPopoverContext,
  )
// @ts-expect-error Root/list state composition stays private to owned compounds.
export const PrivateItems = <CompactTypeaheadSearch controlledItems={items} />
// @ts-expect-error Rendering the owned scaffold is not a public TagComboBox customization channel.
export const PrivateContent = <TagComboBox {...tags} renderContent={() => null} />
export const MissingSelectionOwner = (
  // @ts-expect-error Selected items are always owned by the caller.
  <TagComboBox items={items} selectedItems={[]} getItemKey={(item) => item.id} getItemTextValue={(item) => item.name} />
)
// @ts-expect-error Native roots do not receive DOM refs.
export const DOMRef = <CompactTypeaheadSearch ref={createRef<HTMLDivElement>()} />
