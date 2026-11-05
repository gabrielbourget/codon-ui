import type { TNativeKeyboardData } from "../../input/types"

import type { TTypeaheadEntry } from "./types"

export const createTypeaheadResultsKeyboard = <T>(options: {
  current: () => {
    entries: readonly TTypeaheadEntry<T>[]
    wrap: boolean
    collator: Intl.Collator
    live: boolean
  }
  focus: (key: string) => void
  page: (key: string, direction: -1 | 1) => void
  activate: (key: string) => void
  clear: () => void
}) => {
  let search = ""
  let timeout: ReturnType<typeof setTimeout> | undefined
  const held = new Set<number>()
  return {
    receive: (key: string, data: Omit<TNativeKeyboardData, "kind">, admitted: boolean, composing: boolean) => {
      if (data.phase === "up") {
        held.delete(data.nativeCode)
        return
      }
      const current = options.current()
      const index = current.entries.findIndex((entry) => entry.encodedKey === key)
      if (!current.live || composing || data.cancelled || index < 0) return
      const character = data.key.length === 1 || !/^[A-Z]/i.test(data.key) ? data.key : ""
      if (character && !data.ctrlKey && !data.metaKey && !(search.length === 0 && character === " ")) {
        search += character
        // Preserve the pinned delegate's falsey-key search origin rather than normalizing caller keys.
        const start = current.entries[index]!.key ? index : 0
        const match = [...current.entries.slice(start), ...current.entries.slice(0, start)].find(
          (entry) => entry.text && current.collator.compare(entry.text.slice(0, search.length), search) === 0,
        )
        if (match) options.focus(match.encodedKey)
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          search = ""
        }, 1000)
        return
      }
      if (!admitted) return
      switch (data.key) {
        case "ArrowDown":
        case "ArrowUp": {
          const next = index + (data.key === "ArrowDown" ? 1 : -1)
          if (current.wrap || (next >= 0 && next < current.entries.length))
            options.focus(current.entries[(next + current.entries.length) % current.entries.length]!.encodedKey)
          break
        }
        case "Home":
          options.focus(current.entries[0]!.encodedKey)
          break
        case "End":
          options.focus(current.entries[current.entries.length - 1]!.encodedKey)
          break
        case "PageUp":
          options.page(key, -1)
          break
        case "PageDown":
          options.page(key, 1)
          break
        case "Escape":
          options.clear()
          break
        case "Enter":
        case " ":
          if (!data.repeat && !held.has(data.nativeCode)) {
            held.add(data.nativeCode)
            options.activate(key)
          }
          break
      }
    },
    retire: () => held.clear(),
    dispose: () => {
      held.clear()
      clearTimeout(timeout)
      search = ""
    },
  }
}
