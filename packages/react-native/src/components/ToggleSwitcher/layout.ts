import { useLayoutEffect, useRef, useState } from "react"

import type { TNativeSwitcherFrame } from "./motion"

type TSize = Readonly<{ width: number; height: number }>
type TLayout = {
  signature: object
  frames: ReadonlyMap<string, TNativeSwitcherFrame>
  row?: TSize
}
const validSize = (size: TSize) => [size.width, size.height].every((value) => Number.isFinite(value) && value >= 0)
const sameLength = (left: number | undefined, right: number) => left !== undefined && Math.abs(left - right) < 0.001
const sameSize = (left: TSize | undefined, right: TSize) =>
  sameLength(left?.width, right.width) && sameLength(left?.height, right.height)

export const useNativeSwitcherLayout = (
  signature: object,
  keys: readonly string[],
  boundedWidth: boolean,
  gap: number | string,
  vertical: boolean,
) => {
  const active = useRef<object | undefined>(signature)
  const [stored, setStored] = useState<TLayout>(() => ({ signature, frames: new Map() }))
  useLayoutEffect(() => {
    active.current = signature
    setStored((previous) => ({
      ...previous,
      signature,
      frames: new Map([...previous.frames].filter(([key]) => keys.includes(key))),
    }))
    return () => {
      if (active.current === signature) active.current = undefined
    }
  }, [signature])
  if (
    (typeof gap === "number" && (!Number.isFinite(gap) || gap < 0)) ||
    (typeof gap === "string" && !/^(?:\d+(?:\.\d*)?|\.\d+)%$/.test(gap))
  )
    throw new TypeError("ToggleSwitcher: gap must be a finite nonnegative number or percentage")
  const ratio = typeof gap === "string" ? Number.parseFloat(gap) / 100 : 0
  if (!Number.isFinite(ratio)) throw new TypeError("ToggleSwitcher: gap percentage must be finite")
  const actualGap = (typeof gap === "number" ? gap : 0) + (stored.row?.width ?? 0) * ratio
  // Explicit width or stretch gives the original row a bounded size. A natural
  // root keeps ordinary native option widths; no hidden max-content pass runs.
  const columnWidth =
    boundedWidth && stored.row
      ? Math.max(
          0,
          vertical
            ? stored.row.width
            : (stored.row.width - actualGap * Math.max(0, keys.length - 1)) / Math.max(1, keys.length),
        )
      : undefined
  const update = (mutate: (layout: TLayout) => TLayout) => {
    if (active.current !== signature) return
    setStored((previous) => (active.current === signature ? mutate(previous) : previous))
  }
  return {
    columnWidth,
    frames: stored.frames,
    row: (size: TSize) => {
      if (validSize(size)) update((layout) => (sameSize(layout.row, size) ? layout : { ...layout, row: size }))
    },
    option: (key: string, frame: TNativeSwitcherFrame) => {
      if (!validSize(frame) || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)) return
      update((layout) => {
        const previous = layout.frames.get(key)
        return sameSize(previous, frame) && sameLength(previous?.x, frame.x) && sameLength(previous?.y, frame.y)
          ? layout
          : { ...layout, frames: new Map(layout.frames).set(key, frame) }
      })
    },
  }
}
