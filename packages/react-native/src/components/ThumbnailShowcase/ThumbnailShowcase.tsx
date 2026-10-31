import { View } from "react-native"

import { getNativeButtonContent } from "../Button/content"

import { NativeThumbnailGrid } from "./layout"
import { getNativeThumbnailShowcaseStyles } from "./styles"
import type { TNativeThumbnailShowcaseProps } from "./types"

export const ThumbnailShowcase = (props: TNativeThumbnailShowcaseProps) => {
  const {
    primaryContent,
    primaryPlaceholder,
    primarySlotStyle: _primaryStyle,
    renderingMode = "all",
    renderOverflow,
    renderSecondaryPlaceholder,
    secondaryItems = [],
    secondaryRowStyle: _rowStyle,
    secondarySlotCount: _count,
    secondaryColumnCount: _columns,
    secondarySlotStyle: _slotStyle,
    style: _style,
    width: _width,
    children: _children,
    testID,
    "data-testid": aliasID,
    ...rootProps
  } = props
  const styles = getNativeThumbnailShowcaseStyles(props)
  const hasMedia = (primaryContent !== null && primaryContent !== undefined) || secondaryItems.length > 0
  const hiddenItemCount = Math.max(secondaryItems.length - styles.count, 0)
  const showSecondary = renderingMode !== "primary" && hasMedia && styles.count > 0
  const slots = showSecondary
    ? Array.from({ length: styles.count }, (_, index) => {
        const item = secondaryItems[index]
        const isOverflow = index === styles.count - 1 && hiddenItemCount > 0 && !!renderOverflow
        return {
          key: item?.id ?? `thumbnail-showcase-placeholder-${index}`,
          content: getNativeButtonContent(
            isOverflow
              ? renderOverflow!({ hiddenItemCount })
              : (item?.content ?? renderSecondaryPlaceholder?.({ index })),
          ),
        }
      })
    : []
  return (
    <View {...rootProps} testID={testID ?? aliasID} style={styles.root}>
      {renderingMode !== "secondary" ? (
        <View testID="thumbnail-showcase-primary" style={styles.primary}>
          {getNativeButtonContent(primaryContent ?? primaryPlaceholder)}
        </View>
      ) : null}
      {showSecondary ? (
        <NativeThumbnailGrid
          columns={styles.columns}
          count={styles.count}
          rowStyle={styles.row}
          rootStyle={styles.root}
        >
          {(trackStyle) =>
            slots.map((slot) => (
              <View key={slot.key} style={trackStyle}>
                <View testID="thumbnail-showcase-secondary-slot" style={styles.secondary}>
                  {slot.content}
                </View>
              </View>
            ))
          }
        </NativeThumbnailGrid>
      ) : null}
    </View>
  )
}
