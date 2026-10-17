import { useLayoutEffect, useRef, useState } from "react"

import type { TNativeSwitcherFrame } from "./motion"

type TSize = Readonly<{ width: number; height: number }>
type TLayout = {
  signature: object
  natural: ReadonlyMap<string, number>
  labels: ReadonlyMap<string, TSize>
  settledLabels: ReadonlyMap<string, TSize>
  frames: ReadonlyMap<string, TNativeSwitcherFrame>
  row?: TSize
  root?: TSize
}
const emptyLayout = (signature: object): TLayout => ({
  signature,
  natural: new Map(),
  labels: new Map(),
  settledLabels: new Map(),
  frames: new Map(),
})
const validSize = (size: TSize) => [size.width, size.height].every((value) => Number.isFinite(value) && value >= 0)
// Native layout events and imperative measurements can encode the same size at different precision.
const sameLength = (left: number | undefined, right: number) => left !== undefined && Math.abs(left - right) < 0.001
const sameSize = (left: TSize | undefined, right: TSize) =>
  sameLength(left?.width, right.width) && sameLength(left?.height, right.height)

export const useNativeSwitcherLayout = (
  signature: object,
  keys: readonly string[],
  authoredWidth: boolean,
  gap: number | string,
  vertical: boolean,
) => {
  const active = useRef<object | undefined>(signature)
  const [stored, setStored] = useState(() => emptyLayout(signature))
  const retainedFrames = (frames: ReadonlyMap<string, TNativeSwitcherFrame>) =>
    new Map([...frames].filter(([key]) => keys.includes(key)))
  useLayoutEffect(() => {
    active.current = signature
    setStored((previous) =>
      previous.signature === signature
        ? previous
        : {
            ...emptyLayout(signature),
            root: previous.root,
            row: previous.row,
            frames: retainedFrames(previous.frames),
          },
    )
    return () => {
      if (active.current === signature) active.current = undefined
    }
  }, [signature])
  const current =
    stored.signature === signature
      ? stored
      : { ...emptyLayout(signature), root: stored.root, row: stored.row, frames: retainedFrames(stored.frames) }
  const ready = keys.every((key) => current.natural.has(key) && current.labels.has(key))
  const insetSnapshot = useRef<number | undefined>(undefined)
  if (!ready || stored.signature !== signature) insetSnapshot.current = undefined
  const widths = keys.map((key) => current.natural.get(key) ?? 0)
  const maximum = Math.max(0, ...widths)
  if (
    (typeof gap === "number" && (!Number.isFinite(gap) || gap < 0)) ||
    (typeof gap === "string" && !/^(?:\d+(?:\.\d*)?|\.\d+)%$/.test(gap))
  )
    throw new TypeError("ToggleSwitcher: gap must be a finite nonnegative number or percentage")
  const ratio = typeof gap === "string" ? Number.parseFloat(gap) / 100 : 0
  if (!Number.isFinite(ratio)) throw new TypeError("ToggleSwitcher: gap percentage must be finite")
  const fixedGap = typeof gap === "number" ? Math.max(0, gap) : 0
  const count = keys.length
  const denominator = 1 - Math.max(0, count - 1) * ratio
  const desiredContent = vertical
    ? maximum
    : denominator > 0
      ? (maximum * count + fixedGap * Math.max(0, count - 1)) / denominator
      : undefined
  // Freeze the natural-pass inset before root and row resize events can arrive separately.
  if (ready && insetSnapshot.current === undefined && current.root && current.row)
    insetSnapshot.current = Math.max(0, current.root.width - current.row.width)
  const inset = insetSnapshot.current
  const desiredWidth =
    !authoredWidth && ready && inset !== undefined && desiredContent !== undefined ? desiredContent + inset : undefined
  const actualGap = fixedGap + (current.row?.width ?? 0) * ratio
  const columnWidth =
    ready && current.row
      ? Math.max(
          0,
          vertical ? current.row.width : (current.row.width - actualGap * Math.max(0, count - 1)) / Math.max(1, count),
        )
      : undefined
  const update = (mutate: (layout: TLayout) => TLayout) => {
    if (active.current !== signature) return
    setStored((previous) => {
      if (active.current !== signature) return previous
      return mutate(
        previous.signature === signature
          ? previous
          : {
              ...emptyLayout(signature),
              root: previous.root,
              row: previous.row,
              frames: retainedFrames(previous.frames),
            },
      )
    })
  }
  return {
    desiredWidth,
    columnWidth,
    frames: current.frames,
    natural: (key: string, size: TSize, authored = false) => {
      if ((columnWidth !== undefined && !authored) || !validSize(size)) return
      update((layout) =>
        sameLength(layout.natural.get(key), size.width)
          ? layout
          : { ...layout, natural: new Map(layout.natural).set(key, size.width) },
      )
    },
    root: (size: TSize) => {
      if (validSize(size)) update((layout) => (sameSize(layout.root, size) ? layout : { ...layout, root: size }))
    },
    row: (size: TSize) => {
      if (validSize(size)) update((layout) => (sameSize(layout.row, size) ? layout : { ...layout, row: size }))
    },
    option: (key: string, frame: TNativeSwitcherFrame) => {
      if (!validSize(frame) || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)) return
      update((layout) => {
        const previous = layout.frames.get(key)
        const unchanged =
          sameSize(previous, frame) && sameLength(previous?.x, frame.x) && sameLength(previous?.y, frame.y)
        if (unchanged && (columnWidth !== undefined || sameLength(layout.natural.get(key), frame.width))) return layout
        return {
          ...layout,
          frames: new Map(layout.frames).set(key, frame),
          natural: columnWidth === undefined ? new Map(layout.natural).set(key, frame.width) : layout.natural,
        }
      })
    },
    label: (key: string, size: TSize) => {
      if (!validSize(size)) return
      update((layout) => {
        const natural = layout.labels.get(key)
        if (columnWidth === undefined || !natural)
          return sameSize(natural, size) ? layout : { ...layout, labels: new Map(layout.labels).set(key, size) }
        const settled = layout.settledLabels.get(key)
        if (sameSize(settled ?? natural, size)) return layout
        const insetWidth = Math.max(0, (layout.natural.get(key) ?? 0) - natural.width)
        const firstWrap = !settled && natural.width > Math.max(0, columnWidth - insetWidth) + 0.5
        if (firstWrap) return { ...layout, settledLabels: new Map(layout.settledLabels).set(key, size) }
        // Re-measure the same label tree when its content changes, without cloning or remounting it.
        return {
          ...emptyLayout(signature),
          frames: layout.frames,
          root: layout.root,
          row: layout.row,
          labels: new Map([[key, size]]),
        }
      })
    },
  }
}
