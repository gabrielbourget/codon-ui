/* Copyright 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
/* Adapted from pinned react-aria3.48.0 useGridSelectionAnnouncement; Apache-2.0. */
import type { TNativeListState } from "../../collection/state"

import {
  nativeTagSelectionMessages,
  type TNativeTagSelectionMessageArguments,
  type TNativeTagSelectionMessageKey,
} from "./selectionMessages"
import type { TNativeTagGroupLabels } from "./types"

type TSelection = TNativeListState<object>["selectionManager"]["rawSelection"]
type TState = Pick<TNativeListState<object>, "collection" | "selectionManager">
const difference = (selection: TSelection, previous: TSelection) =>
  selection === "all" || previous === "all"
    ? new Set<string | number>()
    : new Set([...selection].filter((key) => !previous.has(key)))

// Collection sizes are integers. The pinned messages use only =0, one and other.
const integerCardinal = (locale: string, count: number) => {
  const language = locale.split("-")[0]
  if (["ja", "ko", "zh"].includes(language)) return "other"
  if (["hr", "lv", "ru", "sr", "uk"].includes(language)) return count % 10 === 1 && count % 100 !== 11 ? "one" : "other"
  if (language === "lt") return count % 10 === 1 && !(count % 100 >= 11 && count % 100 <= 19) ? "one" : "other"
  if (language === "sl") return count % 100 === 1 ? "one" : "other"
  if (language === "fr" || locale === "pt-BR") return count === 0 || count === 1 ? "one" : "other"
  return count === 1 ? "one" : "other"
}

export const formatNativeTagSelectionMessage = (
  key: TNativeTagSelectionMessageKey,
  args: TNativeTagSelectionMessageArguments,
  labels: TNativeTagGroupLabels = {},
  locale = new Intl.DateTimeFormat().resolvedOptions().locale,
) => {
  if (key === "selectedAll" && labels.selectedAll !== undefined) return labels.selectedAll
  if (key === "selectedCount" && labels.selectedCount) return labels.selectedCount(args.count)
  if (key === "selectedItem" && labels.selectedItem) return labels.selectedItem(args.item)
  if (key === "deselectedItem" && labels.deselectedItem) return labels.deselectedItem(args.item)
  const language = typeof Intl.Locale === "function" ? new Intl.Locale(locale).language : locale.split("-")[0]
  const messageLocale = nativeTagSelectionMessages[locale]
    ? locale
    : nativeTagSelectionMessages[language]
      ? language
      : (Object.keys(nativeTagSelectionMessages).find((name) => name.startsWith(language + "-")) ?? "en-US")
  const messages = nativeTagSelectionMessages[messageLocale]
  const message = messages[key]
  return typeof message === "string"
    ? message
    : message(args, {
        number: (value) => new Intl.NumberFormat(locale).format(value),
        plural: (count, cases) => {
          const category = () =>
            typeof Intl.PluralRules === "function"
              ? new Intl.PluralRules(locale).select(count)
              : integerCardinal(messageLocale, count)
          const result = cases[`=${count}`] ?? cases[category()] ?? cases.other
          return typeof result === "function" ? result() : result
        },
      })
}

export const nativeTagSelectionAnnouncement = (
  state: TState,
  previous: TSelection,
  labels: TNativeTagGroupLabels = {},
) => {
  const manager = state.selectionManager
  const selection = manager.rawSelection
  if (!manager.isFocused || selection === previous) return ""
  const added = difference(selection, previous)
  const removed = difference(previous, selection)
  const messages: string[] = []
  const text = (key: string | number) =>
    state.collection.getTextValue?.(key) ?? state.collection.getItem(key)?.textValue
  const itemMessage = (
    key: string | number | undefined,
    kind: "selectedItem" | "deselectedItem",
    requireItem: boolean,
  ) => {
    if (key == null || (requireItem && !state.collection.getItem(key))) return
    const item = text(key)
    if (item) messages.push(formatNativeTagSelectionMessage(kind, { item, count: 0 }, labels))
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
      formatNativeTagSelectionMessage(
        selection === "all" ? "selectedAll" : "selectedCount",
        { item: "", count: selection === "all" ? 0 : selection.size },
        labels,
      ),
    )
  return messages.join(" ")
}
