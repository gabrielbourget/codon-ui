/* Native geometry counterpart of pinned ListKeyboardDelegate; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import type { View } from "react-native"

import type { TNativeCollectionLayoutDelegate, TNativeCollectionRect } from "../../collection/renderer"
import type { TNativeCollectionKey } from "../../collection/snapshot"

export type TNativeComboBoxListMetrics = {
  revision: number
  content: { width: number; height: number } | null
}
export const createNativeComboBoxListMetrics = (): TNativeComboBoxListMetrics => ({
  revision: 0,
  content: null,
})

export const getNativeComboBoxPageKey = (
  keys: readonly TNativeCollectionKey[],
  focused: TNativeCollectionKey,
  key: "PageUp" | "PageDown",
  layout: TNativeCollectionLayoutDelegate,
): TNativeCollectionKey | null => {
  let rect = layout.getItemRect?.(focused)
  let index = keys.indexOf(focused)
  if (!rect || index < 0) return null
  const backwards = key === "PageUp"
  const page = backwards
    ? Math.max(0, rect.y + rect.height - layout.getVisibleRect().height)
    : Math.min(layout.getContentSize().height, rect.y - rect.height + layout.getVisibleRect().height)
  while (rect && (backwards ? rect.y > page : rect.y < page)) {
    index += backwards ? -1 : 1
    if (index < 0 || index >= keys.length) return backwards ? (keys[0] ?? null) : (keys.at(-1) ?? null)
    rect = layout.getItemRect?.(keys[index])
  }
  return keys[index]
}

export const readNativeComboBoxPageLayout = ({
  viewport,
  contentTarget,
  rows,
  metrics,
  current,
  complete,
}: {
  viewport: Pick<View, "measureInWindow">
  contentTarget: View
  rows: readonly { key: TNativeCollectionKey; target: View }[]
  metrics: TNativeComboBoxListMetrics
  current: () => boolean
  complete: (layout: TNativeCollectionLayoutDelegate) => void
}) => {
  const content = metrics.content
  if (!content || rows.length === 0 || !current()) return
  const valid = (values: readonly number[]) => values.every(Number.isFinite)
  contentTarget.measureInWindow((contentX, contentY) => {
    if (!current() || !valid([contentX, contentY])) return
    viewport.measureInWindow((x, y, width, height) => {
      if (!current() || !valid([x, y, width, height]) || width <= 0 || height <= 0) return
      const rectangles = new Map<TNativeCollectionKey, TNativeCollectionRect>()
      for (const row of rows)
        row.target.measureInWindow((rowX, rowY, rowWidth, rowHeight) => {
          if (!current() || !valid([rowX, rowY, rowWidth, rowHeight]) || rowWidth < 0 || rowHeight < 0) return
          rectangles.set(row.key, {
            x: rowX - contentX,
            y: rowY - contentY,
            width: rowWidth,
            height: rowHeight,
          })
          if (rectangles.size === rows.length)
            complete({
              getItemRect: (key) => rectangles.get(key) ?? null,
              getContentSize: () => content,
              getVisibleRect: () => ({ x: x - contentX, y: y - contentY, width, height }),
            })
        })
    })
  })
}
