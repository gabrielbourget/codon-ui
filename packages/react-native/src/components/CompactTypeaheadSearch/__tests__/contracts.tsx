import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { NativeFocusHost } from "../../../input/NativeFocusView"
import { CompactTypeaheadSearch } from "../CompactTypeaheadSearch"

const source = [{ key: 0, label: "" }]
const root = (
  <CompactTypeaheadSearch
    ref={createRef<View>()}
    inputRef={createRef<TextInput>()}
    items={source}
    value={null}
    defaultValue={0}
    inputValue=""
    isOpen={false}
    minimumInputLength={0}
    height={0}
    width={0}
    color="blue"
    SearchIcon={false}
    LoadingIndicator={0}
    getItemKey={(item) => item.key}
    getItemTextValue={(item) => item.label}
    onChange={(key) => {
      const original: string | number | null = key
      void original
    }}
    renderItem={(item, args) => `${item.key}:${args.itemKey}:${args.query}:${args.textValue}`}
    inputProps={{
      onChange: (event) => {
        const count: number = event.nativeEvent.eventCount
        void count
      },
    }}
    style={({ defaultStyle, isOpen }) => [{ ...defaultStyle, marginTop: isOpen ? 0 : 1 }]}
  />
)
void root
// @ts-expect-error DOM classes map to native style slots.
const cssClass = <CompactTypeaheadSearch className="browser-only" />
// @ts-expect-error Source-owned native refs remain actual native instances.
const domRef = <CompactTypeaheadSearch ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Native query values are strings; null is a selected-value contract.
const nullQuery = <CompactTypeaheadSearch inputValue={null} />
// @ts-expect-error Native styles use logical dimensions, without CSS units.
const cssWidth = <CompactTypeaheadSearch width="10rem" />
const inheritedField = (
  <CompactTypeaheadSearch
    items={source}
    name="search"
    form="filters"
    formValue="text"
    validationBehavior="aria"
    isRequired
    validate={({ inputValue, value, selectedKey }) =>
      inputValue.length && value !== null && selectedKey !== null ? null : "Choose a result"
    }
    slot={null}
    nativeDescribedBy={["search-description"]}
    render={(props, state) => <NativeFocusHost {...props} testID={state.isInvalid ? "invalid" : "valid"} />}
  />
)
// @ts-expect-error Form serialization has the same key/text modes as ComboBox.
const invalidFormValue = <CompactTypeaheadSearch formValue="object" />
// @ts-expect-error Internal composition hooks are not part of the component API.
const privateContent = <CompactTypeaheadSearch renderContent={() => null} />
void [cssClass, domRef, nullQuery, cssWidth, inheritedField, invalidFormValue, privateContent]
