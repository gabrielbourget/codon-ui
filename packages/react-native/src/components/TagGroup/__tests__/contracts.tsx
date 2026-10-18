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
// @ts-expect-error Native style owners do not advertise DOM class strings.
export const domClass = <TagGroup className="ignored" />
