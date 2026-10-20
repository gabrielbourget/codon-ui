import { createRef } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../.."
import { Button } from "../../Button/Button"
import { NativeButtonContext } from "../../Button/context"
import { NativeTagListContext } from "../context"
import { NativeTagGroupLabelContext, NativeTagGroupTextContext, TagGroupLabel, TagGroupText } from "../field"
import { Tag } from "../Tag"
import { TagGroup, NativeTagList } from "../TagGroup"
import type { TNativeTagListProps } from "../types"

const ref = createRef<View>()
export const controlled = (
  <TagGroup
    ref={ref}
    selectionMode="multiple"
    selectedKeys={new Set([0, ""])}
    onSelectionChange={(keys) => {
      if (keys !== "all") keys.has(0)
    }}
    onRemove={(keys) => keys.has("")}
  >
    <Tag
      ref={ref}
      id={0}
      style={(state) => ({ ...state.defaultStyle, opacity: state.isSelected ? 1 : 0 })}
      onPress={(event) => {
        if ("kind" in event.nativeEvent) event.nativeEvent.kind.toUpperCase()
      }}
    >
      {(state) => (state.allowsRemoving ? "Removable" : "Tag")}
    </Tag>
  </TagGroup>
)
export const dynamic = (
  <TagGroup items={[{ id: 0, label: "Zero" }]} getKey={(item) => item.id}>
    {(item) => <Tag>{item.label}</Tag>}
  </TagGroup>
)
// @ts-expect-error Grouped keys preserve native string/number identity.
export const booleanKey = <Tag id={false} />
// @ts-expect-error Native refs retain actual View instances.
export const domRef = <TagGroup ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Group selection owns the rendered selected state.
export const ownedSelection = <Tag accessibilityState={{ selected: true }} />
// @ts-expect-error Hyphenated aliases cannot override group-owned selection.
export const ownedAlias = <Tag aria-selected />
// @ts-expect-error Grouped rows do not expose independent checked state.
export const checkedAlias = <Tag aria-checked />
// @ts-expect-error Grouped rows do not expose independent expanded state.
export const expandedAlias = <Tag aria-expanded />
// @ts-expect-error Disabled state is derived from root and item ownership.
export const disabledAlias = <Tag aria-disabled />
// @ts-expect-error Grouped rows do not expose independent pending state.
export const busyAlias = <Tag aria-busy />
// @ts-expect-error Native style owners do not advertise DOM class strings.
export const domClass = <TagGroup className="ignored" />

export const relationships = (
  <TagGroup
    aria-labelledby="tag-label"
    ariaDescribedBy={["tag-description"]}
    aria-details="tag-details"
    labels={{ descriptionLabel: "Instructions", detailsLabel: "" }}
  />
)
// @ts-expect-error Native relationship identities are strings, not collection keys.
export const invalidRelationship = <TagGroup ariaDescribedBy={[0]} />

type TTagValue = { id: string; label: string }
const listDefaults: TNativeTagListProps<TTagValue> = {
  items: [{ id: "a", label: "Alpha" }],
  children: (item) => <Tag id={item.id}>{item.label}</Tag>,
  style: (state) => ({ ...state.defaultStyle, fontSize: state.isFocused ? 20 : 18 }),
  render: (props, state) => {
    state.state.selectionManager.isSelected(0)
    return <NativeFocusView {...props} />
  },
  renderEmptyState: (state) => (state.isEmpty ? "No tags" : null),
}
export const listContext = (
  <NativeTagListContext.Provider value={listDefaults}>
    <NativeTagList ref={ref} slot={null} />
  </NativeTagListContext.Provider>
)
export const inheritedTypography = <TagGroup style={{ fontSize: 18 }} customTagListStyles={{ fontWeight: "700" }} />
// @ts-expect-error List refs remain original native View instances.
export const invalidListRef = <NativeTagList ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Native list typography does not accept browser pixel strings.
export const invalidListStyle = <NativeTagList style={{ fontSize: "18px" }} />

export const fieldContexts = (
  <NativeTagGroupLabelContext.Provider value={{ ref: createRef<import("react-native").Text>(), nativeID: "label" }}>
    <TagGroupLabel slot={null} />
    <NativeTagGroupTextContext.Provider value={{ slots: { description: { nativeID: "description" } } }}>
      <TagGroupText slot="description" />
    </NativeTagGroupTextContext.Provider>
    <NativeButtonContext.Provider value={{ slots: { remove: { onPress: (event) => event.nativeEvent.target } } }}>
      <Button slot="remove">Remove</Button>
    </NativeButtonContext.Provider>
  </NativeTagGroupLabelContext.Provider>
)
// @ts-expect-error Field labels retain native text refs.
export const invalidFieldLabelRef = <TagGroupLabel ref={createRef<HTMLSpanElement>()} />
// @ts-expect-error Field description styles remain native text styles.
export const invalidFieldTextStyle = <TagGroupText style={{ fontSize: "18px" }} />
// @ts-expect-error Native slot names are strings or null.
export const invalidButtonSlot = <Button slot={0}>Remove</Button>
