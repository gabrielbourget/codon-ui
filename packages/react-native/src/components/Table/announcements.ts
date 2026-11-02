/* Copyright 2020, 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
/* Adapted from pinned react-aria3.48.0 table/useTable and grid/useGridSelectionAnnouncement. */
import type { TNativeTableGridMessageArguments, TNativeTableGridMessageKey } from "./gridMessages"
import { nativeTableGridMessages } from "./gridMessages"
import { nativeTableSortMessages } from "./sortMessages"
import type { TNativeTableState } from "./state/useTableState"

type TSelection = TNativeTableState<object>["selectionManager"]["rawSelection"]
type TState = Pick<TNativeTableState<object>, "collection" | "selectionManager">
const localeMessages = <T>(messages: Record<string, T>, locale: string): T => {
  const language = typeof Intl.Locale === "function" ? new Intl.Locale(locale).language : locale.split("-")[0]
  return (
    messages[locale] ??
    messages[language] ??
    Object.entries(messages).find(([key]) => key.startsWith(`${language}-`))?.[1] ??
    messages["en-US"]
  )
}
const integerCardinal = (locale: string, count: number) => {
  const language = locale.split("-")[0]
  if (["ja", "ko", "zh"].includes(language)) return "other"
  if (["hr", "lv", "ru", "sr", "uk"].includes(language)) return count % 10 === 1 && count % 100 !== 11 ? "one" : "other"
  if (language === "lt") return count % 10 === 1 && !(count % 100 >= 11 && count % 100 <= 19) ? "one" : "other"
  if (language === "sl") return count % 100 === 1 ? "one" : "other"
  if (language === "fr" || locale === "pt-BR") return count === 0 || count === 1 ? "one" : "other"
  return count === 1 ? "one" : "other"
}
const gridMessage = (key: TNativeTableGridMessageKey, args: TNativeTableGridMessageArguments, locale: string) => {
  const message = localeMessages(nativeTableGridMessages, locale)[key]
  return typeof message === "string"
    ? message
    : message(args, {
        number: (value) => new Intl.NumberFormat(locale).format(value),
        plural: (count, cases) => {
          const category =
            typeof Intl.PluralRules === "function"
              ? new Intl.PluralRules(locale).select(count)
              : integerCardinal(locale, count)
          const result = cases[`=${count}`] ?? cases[category] ?? cases.other
          return typeof result === "function" ? result() : result
        },
      })
}
export const nativeTableSortDescription = (
  state: Pick<TNativeTableState<object>, "sortDescriptor" | "collection">,
  locale: string,
) => {
  const { column, direction } = state.sortDescriptor ?? {}
  // Retain the pinned receiver's truthy-column condition, including zero/empty keys.
  if (!column || !direction) return undefined
  const node = state.collection.columns.find((candidate) => candidate.key === column)
  const nativeName = typeof node?.props.accessibilityLabel === "string" ? node.props.accessibilityLabel : ""
  const columnName = node?.props.textValue !== undefined ? node.textValue : node?.textValue || nativeName
  return localeMessages(nativeTableSortMessages, locale)[
    direction === "ascending" ? "ascendingSort" : "descendingSort"
  ]({ columnName })
}
const sameSelection = (a: TSelection, b: TSelection) =>
  a === b || (a !== "all" && b !== "all" && a.size === b.size && [...a].every((key) => b.has(key)))
const difference = (a: TSelection, b: TSelection) =>
  a === "all" || b === "all" ? new Set<string | number>() : new Set([...a].filter((key) => !b.has(key)))
export const nativeTableSelectionAnnouncement = (state: TState, previous: TSelection, locale: string) => {
  const manager = state.selectionManager,
    selection = manager.rawSelection
  // Native controlled owner echoes with identical keys do not represent a second selection change.
  if (!manager.isFocused || sameSelection(selection, previous)) return ""
  const added = difference(selection, previous),
    removed = difference(previous, selection),
    messages: string[] = []
  const itemMessage = (
    key: string | number | undefined,
    kind: "selectedItem" | "deselectedItem",
    requireItem: boolean,
  ) => {
    if (key == null || (requireItem && !state.collection.getItem(key))) return
    const item = state.collection.getTextValue?.(key) ?? state.collection.getItem(key)?.textValue
    if (item) messages.push(gridMessage(kind, { item, count: 0 }, locale))
  }
  if (manager.selectedKeys.size === 1 && manager.selectionBehavior === "replace")
    itemMessage(manager.selectedKeys.keys().next().value, "selectedItem", true)
  else if (added.size === 1 && removed.size === 0) itemMessage(added.keys().next().value, "selectedItem", false)
  else if (removed.size === 1 && added.size === 0) itemMessage(removed.keys().next().value, "deselectedItem", true)
  if (
    manager.selectionMode === "multiple" &&
    (!messages.length || selection === "all" || selection.size > 1 || previous === "all" || previous.size > 1)
  )
    messages.push(
      gridMessage(
        selection === "all" ? "selectedAll" : "selectedCount",
        { item: "", count: selection === "all" ? 0 : selection.size },
        locale,
      ),
    )
  return messages.join(" ")
}

export const nativeTableColumnDescription = (
  enabled: boolean,
  direction: "ascending" | "descending" | undefined,
  locale: string,
  android: boolean,
) => {
  if (!enabled) return undefined
  const messages = localeMessages(nativeTableSortMessages, locale)
  return messages.sortable + (android && direction ? `, ${messages[direction]}` : "")
}
export const nativeTableSortDirectionText = (direction: "ascending" | "descending", locale: string) =>
  localeMessages(nativeTableSortMessages, locale)[direction]
export const nativeTableLongPressDescription = (
  manager: TState["selectionManager"],
  hasItemActions: boolean,
  origin: "keyboard" | "pointer" | "virtual" | null,
  locale: string,
  mobile: boolean,
) =>
  mobile &&
  origin !== "keyboard" &&
  manager.selectionBehavior === "replace" &&
  manager.selectionMode !== "none" &&
  hasItemActions
    ? gridMessage("longPressToSelect", { item: "", count: 0 }, locale)
    : undefined

export const nativeTableExpansionLabel = (expanded: boolean, locale: string) =>
  localeMessages(nativeTableSortMessages, locale)[expanded ? "collapse" : "expand"]
