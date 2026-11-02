import type { ReactElement } from "react"

import type { TNativeCollectionItem, TNativeCollectionKey } from "../../../collection/snapshot"
import type { TNativeGroupedTagProps } from "../types"

// Each caller supplies ordered membership and its original visible receiver explicitly.
export const tagItem = <T extends object = object>(
  key: TNativeCollectionKey,
  element: ReactElement<TNativeGroupedTagProps>,
  value: T | null = null,
): TNativeCollectionItem<T> => ({
  key,
  type: "item",
  value,
  props: element.props,
  rendered: typeof element.props.children === "function" ? null : element.props.children,
  textValue:
    element.props.textValue ??
    element.props.accessibilityLabel ??
    element.props["aria-label"] ??
    (typeof element.props.children === "string" || typeof element.props.children === "number"
      ? String(element.props.children)
      : ""),
  render: () => element,
})
