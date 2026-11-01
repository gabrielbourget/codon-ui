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
    defaultItems={source}
    selectionMode="single"
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
    aria-labelledby="visible-search-label"
    aria-describedby="search-description"
    aria-details="search-details"
    render={(props, state) => <NativeFocusHost {...props} testID={state.isInvalid ? "invalid" : "valid"} />}
  />
)
// @ts-expect-error Form serialization has the same key/text modes as ComboBox.
const invalidFormValue = <CompactTypeaheadSearch formValue="object" />
// @ts-expect-error Internal composition hooks are not part of the component API.
const privateContent = <CompactTypeaheadSearch renderContent={() => null} />
// @ts-expect-error Source root/list state composition is private to the wrapper.
const privateItems = <CompactTypeaheadSearch controlledItems={source} />
// @ts-expect-error Canonical CompactTypeaheadSearch has a single selected value.
const multiple = <CompactTypeaheadSearch selectionMode="multiple" />
// @ts-expect-error ARIA aliases contain whitespace-separated IDs; native relationships accept arrays separately.
const invalidDescription = <CompactTypeaheadSearch aria-describedby={["description"]} />
void [
  cssClass,
  domRef,
  nullQuery,
  cssWidth,
  inheritedField,
  invalidFormValue,
  privateContent,
  privateItems,
  multiple,
  invalidDescription,
]

const inheritedRootContract = (
  <CompactTypeaheadSearch
    items={source}
    inputValue=""
    render={(native, state) => {
      const flags: boolean[] = [state.isOpen, state.isDisabled, state.isReadOnly, state.isInvalid, state.isRequired]
      return <NativeFocusHost {...native} accessibilityHint={flags.some(Boolean) ? "Active" : "Idle"} />
    }}
  />
)
// @ts-expect-error The wrapper owns its scaffold; caller content uses the public item/icon/root channels.
const replacedScaffold = <CompactTypeaheadSearch>Replacement</CompactTypeaheadSearch>
// @ts-expect-error A custom native root must return the original host element rather than removing it.
const missingRenderedHost = <CompactTypeaheadSearch render={() => null} />
const foreignRenderedRef = (
  <CompactTypeaheadSearch
    render={(native) => (
      // @ts-expect-error Inherited root rendering preserves an actual native View ref.
      <NativeFocusHost {...native} ref={createRef<HTMLDivElement>()} />
    )}
  />
)
void [inheritedRootContract, replacedScaffold, missingRenderedHost, foreignRenderedRef]

// @ts-expect-error DOM-only CSS transition observations are replaced by the native style/animation owner.
const browserTransition = <CompactTypeaheadSearch onTransitionEnd={() => {}} />
// @ts-expect-error Browser mouse events do not substitute for original native pointer/responder events.
const browserMouse = <CompactTypeaheadSearch onMouseDown={() => {}} />
void [browserTransition, browserMouse]
