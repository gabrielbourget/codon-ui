import type { ReactElement, ReactNode } from "react"

import type { TNativeCollectionItem, TNativeCollectionKey } from "../../../collection/snapshot"

// Source fixtures author membership, order, text and keys explicitly; render keeps the original receiver element.
export const menuModelEntry = (
  key: TNativeCollectionKey,
  element: ReactElement<{ children?: ReactNode }>,
  textValue: string,
  type = "item",
  children?: readonly TNativeCollectionItem<object>[],
  value: object | null = null,
): TNativeCollectionItem<object> => ({
  key,
  type,
  value,
  props: element.props,
  rendered: element.props.children ?? null,
  textValue,
  children,
  render: () => element,
})
