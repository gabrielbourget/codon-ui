import { createRef } from "react"
import { PlatformColor, StyleSheet, type TextInput, type View } from "react-native"

import {
  Text,
  TypeaheadSearch,
  resolveTypeaheadSearchLabels,
  type TypeaheadSearchProps,
  type TypeaheadSearchStatus,
  type PartialTypeaheadSearchLabels,
  type TNativeTypeaheadSearchKey,
} from "../src"

type TItem = { id: number | string; name: string }
const root = createRef<View>()
const input = createRef<TextInput>()
const styles = StyleSheet.create({ row: { borderWidth: 0 } })
const items: readonly TItem[] = [
  { id: 0, name: "Zero" },
  { id: "", name: "Empty" },
]
export const searchLabels: PartialTypeaheadSearchLabels = {
  status: { loadingMessage: "", minimumInputLengthMessage: ({ minimumInputLength }) => String(minimumInputLength) },
}
export const searchStatus: TypeaheadSearchStatus = "minimum-query"
export const searchKey: TNativeTypeaheadSearchKey = NaN
export const searchProps: TypeaheadSearchProps<TItem> = {
  items: new Set(items),
  inputValue: "",
  onInputChange: (value) => value.toUpperCase(),
  getItemKey: (item) => item.id,
  getItemTextValue: (item) => item.name,
  renderItem: (item, args) => (
    <Text>
      {item.name}: {args.query}, {args.textValue}, {String(args.itemKey)}
    </Text>
  ),
  onSelectionChange: (key) => (key === null ? undefined : String(key)),
  onSubmitQuery: (query) => query.trim(),
  status: searchStatus,
  labels: searchLabels,
  minimumInputLength: 0,
  geometry: "orthogonal",
  shouldFocusWrap: false,
  SearchIcon: 0,
  LoadingIndicator: false,
  shouldAutoFocusInput: false,
  inputRef: input,
  accessibilityLabel: "",
  "aria-label": "Alias",
  inputProps: {
    returnKeyType: "search",
    keyboardType: "default",
    selection: { start: 0, end: 0 },
    onChange: (event) => event.nativeEvent.text,
    onSubmitEditing: (event) => event.nativeEvent.text,
    onSelectionChange: (event) => event.nativeEvent.selection.start,
    onKeyPress: (event) => event.nativeEvent.key,
    allowFontScaling: true,
  },
  customStyles: [{ color: PlatformColor("labelColor") }, { width: 0 }],
  style: [{ opacity: 0 }],
  customInputRowStyles: styles.row,
  customInputStyles: { fontSize: 18 },
  customSearchButtonStyles: { height: 35 },
  customResultsContainerStyles: { minHeight: 0, maxHeight: 0, height: 0 },
  customResultsListStyles: [{ gap: 0 }],
  onLayout: (event) => event.nativeEvent.layout.width,
}
export const ValidTypeahead = <TypeaheadSearch {...searchProps} ref={root} />
export const InferredTypeahead = (
  <TypeaheadSearch
    items={items}
    inputValue=""
    onInputChange={() => undefined}
    getItemKey={(item) => item.id}
    renderItem={(item) => item.name}
  />
)
export const ResolvedSearchLabels = resolveTypeaheadSearchLabels({ labels: searchLabels, emptyListMessage: "" })
const controlled = { inputValue: "", onInputChange: () => undefined }
const invalidChange = (event: { nativeEvent: { text: number } }) => event.nativeEvent.text
// @ts-expect-error The query remains required and controlled.
export const SearchMissingQuery = <TypeaheadSearch onInputChange={() => undefined} />
// @ts-expect-error The query callback is required.
export const SearchMissingCallback = <TypeaheadSearch inputValue="" />
// @ts-expect-error Native search queries remain strings.
export const SearchNumericQuery = <TypeaheadSearch {...controlled} inputValue={0} />
// @ts-expect-error The surface owns the native Input value.
export const SearchInputValue = <TypeaheadSearch {...controlled} inputProps={{ value: "other" }} />
// @ts-expect-error Native observers cannot replace business text callbacks.
export const SearchInputChange = <TypeaheadSearch {...controlled} inputProps={{ onChangeText: invalidChange }} />
// @ts-expect-error The style slot owns input presentation.
export const SearchInputStyle = <TypeaheadSearch {...controlled} inputProps={{ style: {} }} />
// @ts-expect-error Unknown status strings do not create another status mode.
export const SearchStatus = <TypeaheadSearch {...controlled} status="pending" />
// @ts-expect-error There is no caller-owned selection axis.
export const SearchSelection = <TypeaheadSearch {...controlled} selectedKeys={new Set()} />
// @ts-expect-error Native styles replace DOM classes.
export const SearchClass = <TypeaheadSearch {...controlled} className="search" />
// @ts-expect-error The root exposes a native View ref.
export const SearchRef = <TypeaheadSearch {...controlled} ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Native font sizes use logical numbers.
export const SearchFont = <TypeaheadSearch {...controlled} customInputStyles={{ fontSize: "1rem" }} />
// @ts-expect-error Canonical root style is a value rather than a render callback.
export const SearchStyle = <TypeaheadSearch {...controlled} style={() => ({ opacity: 0 })} />
// @ts-expect-error Native event observers cannot require a numeric text payload.
export const SearchEvent = <TypeaheadSearch {...controlled} inputProps={{ onChange: invalidChange }} />
// @ts-expect-error The owned shell does not accept arbitrary root children.
export const SearchChildren = <TypeaheadSearch {...controlled}>Other</TypeaheadSearch>
// @ts-expect-error Items retain the canonical object domain.
export const SearchItems = <TypeaheadSearch {...controlled} items={[1, 2]} />
