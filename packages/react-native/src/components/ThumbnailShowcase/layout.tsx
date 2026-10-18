import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { View, type ViewStyle } from "react-native"

import { resolveNativeThumbnailGap } from "./styles"

const MEASUREMENT_FIELDS = [
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
  "boxSizing",
  "display",
  "direction",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "alignContent",
  "justifyContent",
  "top",
  "bottom",
  "paddingBlock",
  "paddingBlockStart",
  "paddingBlockEnd",
  "paddingInline",
  "paddingInlineStart",
  "paddingInlineEnd",
  "marginBlock",
  "marginBlockStart",
  "marginBlockEnd",
  "marginInline",
  "marginInlineStart",
  "marginInlineEnd",
  "flex",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "alignSelf",
  "position",
  "left",
  "right",
  "start",
  "end",
  "padding",
  "paddingHorizontal",
  "paddingVertical",
  "paddingLeft",
  "paddingRight",
  "paddingStart",
  "paddingEnd",
  "paddingTop",
  "paddingBottom",
  "borderWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderStartWidth",
  "borderEndWidth",
  "borderTopWidth",
  "borderBottomWidth",
  "margin",
  "marginHorizontal",
  "marginVertical",
  "marginLeft",
  "marginRight",
  "marginStart",
  "marginEnd",
  "marginTop",
  "marginBottom",
] as const

export const NativeThumbnailGrid = ({
  children,
  columns,
  count,
  rowStyle,
  rootStyle,
}: {
  children: (trackStyle: ViewStyle) => ReactNode
  columns: number
  count: number
  rowStyle: ViewStyle
  rootStyle: ViewStyle
}) => {
  const {
    gap = 10,
    columnGap = gap,
    rowGap = gap,
    flexDirection = "row",
    flexWrap,
    alignItems = "stretch",
    alignContent = "flex-start",
    justifyContent = "flex-start",
    direction,
    ...frameStyle
  } = rowStyle
  const horizontalGap = resolveNativeThumbnailGap(columnGap ?? gap ?? 10)
  const verticalGap = resolveNativeThumbnailGap(rowGap ?? gap ?? 10)
  const [width, setWidth] = useState<number>()
  const values = MEASUREMENT_FIELDS.flatMap((field) => [
    (rootStyle as Record<string, unknown>)[field],
    (rowStyle as Record<string, unknown>)[field],
  ])
  const snapshot = useRef<{ values: unknown[]; signature: object } | undefined>(undefined)
  if (!snapshot.current || values.some((value, index) => !Object.is(value, snapshot.current!.values[index])))
    snapshot.current = { values, signature: {} }
  const signature = snapshot.current.signature
  const active = useRef<object | undefined>(signature)
  useLayoutEffect(() => {
    active.current = signature
    return () => {
      if (active.current === signature) active.current = undefined
    }
  }, [signature])
  const resolvedGap =
    typeof horizontalGap === "number" ? horizontalGap : ((width ?? 0) * Number.parseFloat(horizontalGap)) / 100
  const trackWidth = width === undefined ? undefined : Math.max(0, (width - resolvedGap * (columns - 1)) / columns)
  // Keep a derived fractional width just below its mathematical boundary so native float rounding cannot add a row.
  const calibratedWidth = trackWidth === undefined ? undefined : Math.floor(trackWidth * 1_000_000) / 1_000_000
  const trackStyle: ViewStyle =
    calibratedWidth === undefined
      ? { minWidth: 0, flexBasis: 0, flexGrow: 1, flexShrink: 1 }
      : { minWidth: 0, width: calibratedWidth, flexGrow: 0, flexShrink: 0 }
  const emptyTracks = (columns - (count % columns)) % columns
  const zeroHeight =
    width === 0 && columns < count && typeof verticalGap === "number"
      ? verticalGap * (Math.ceil(count / columns) - 1)
      : undefined
  return (
    <View style={frameStyle}>
      <View
        testID="thumbnail-showcase-grid"
        onLayout={(event) => {
          if (active.current !== signature) return
          const next = event.nativeEvent.layout.width
          if (!Number.isFinite(next) || next < 0) return
          setWidth((previous) => (previous !== undefined && Math.abs(previous - next) < 0.001 ? previous : next))
        }}
        style={{
          width: "100%",
          flexDirection,
          flexWrap: flexWrap ?? (columns < count && width !== 0 ? "wrap" : "nowrap"),
          alignItems,
          alignContent,
          justifyContent,
          direction,
          columnGap: horizontalGap,
          rowGap: verticalGap,
          height: zeroHeight,
        }}
      >
        {children(trackStyle)}
        {emptyTracks > 0 ? (
          <View
            accessible={false}
            pointerEvents="none"
            style={
              calibratedWidth === undefined
                ? { flexBasis: 0, flexGrow: emptyTracks }
                : {
                    width: calibratedWidth * emptyTracks + resolvedGap * Math.max(0, emptyTracks - 1),
                    height: 0,
                    flexShrink: 0,
                  }
            }
          />
        ) : null}
      </View>
    </View>
  )
}
