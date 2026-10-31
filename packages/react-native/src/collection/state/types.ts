import type { ListProps as TSourceListProps, ListState as TSourceListState } from "react-stately/useListState"
import type { MultipleSelectionStateProps as TSourceSelectionProps } from "react-stately/useMultipleSelectionState"
import type { TreeProps as TSourceTreeProps } from "react-stately/useTreeState"

export type Node<T> = NonNullable<ReturnType<TSourceListState<T>["collection"]["getItem"]>>
export type Collection<T extends { value: unknown }> = TSourceListState<Exclude<T["value"], null>>["collection"]
export type Key = Parameters<TSourceListState<unknown>["collection"]["getItem"]>[0]
export type LayoutDelegate = NonNullable<TSourceListProps<unknown>["layoutDelegate"]>
export type SelectionMode = NonNullable<TSourceSelectionProps["selectionMode"]>
export type SelectionBehavior = NonNullable<TSourceSelectionProps["selectionBehavior"]>
export type DisabledBehavior = NonNullable<TSourceSelectionProps["disabledBehavior"]>
export type FocusStrategy = NonNullable<Parameters<TSourceListState<unknown>["selectionManager"]["setFocusedKey"]>[1]>
export type Selection = Parameters<NonNullable<TSourceSelectionProps["onSelectionChange"]>>[0]
export type MultipleSelection = TSourceSelectionProps
export type Expandable = Pick<TSourceTreeProps<unknown>, "expandedKeys" | "defaultExpandedKeys" | "onExpandedChange">
export type CollectionStateBase<T> = Omit<
  TSourceListProps<T>,
  keyof TSourceSelectionProps | "collection" | "filter" | "layoutDelegate" | "suppressTextValueWarning"
> & { collection: TSourceListState<T>["collection"] }
export type TSourceManagerSurface = Omit<TSourceListState<unknown>["selectionManager"], "select" | "withCollection">

export type TNativeSelectionPointerEvent = Readonly<{
  pointerType: string
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}>
export type PressEvent = TNativeSelectionPointerEvent
export type LongPressEvent = TNativeSelectionPointerEvent
