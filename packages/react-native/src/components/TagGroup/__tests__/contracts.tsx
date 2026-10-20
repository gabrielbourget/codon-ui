import { createRef } from "react"
import type { View } from "react-native"

import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"

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
