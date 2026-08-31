import classNames from "classnames"

import {
  DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT,
  normalizeThumbnailShowcaseDimension,
  normalizeThumbnailShowcaseSecondarySlotCount,
  type TThumbnailShowcaseCSSProperties,
  type TThumbnailShowcaseProps,
} from "./helpers"
import styles from "./ThumbnailShowcaseStyles.module.css"

const {
  thumbnailShowcase,
  thumbnailShowcase__primarySlot,
  thumbnailShowcase__secondaryRow,
  thumbnailShowcase__secondarySlot,
} = styles

const ThumbnailShowcase = (props: TThumbnailShowcaseProps) => {
  const {
    className,
    primaryContent,
    primaryPlaceholder,
    primarySlotClassName,
    primarySlotStyle,
    renderingMode = "all",
    renderOverflow,
    renderSecondaryPlaceholder,
    secondaryItems = [],
    secondaryRowClassName,
    secondaryRowStyle,
    secondarySlotClassName,
    secondarySlotCount = DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT,
    secondarySlotStyle,
    style,
    width,
    ...rootProps
  } = props
  const showPrimary = renderingMode !== "secondary"
  const showSecondary = renderingMode !== "primary"
  const hasAvailableMedia = primaryContent != null || secondaryItems.length > 0
  const normalizedSecondarySlotCount = normalizeThumbnailShowcaseSecondarySlotCount(secondarySlotCount)
  const visibleSecondaryItems = secondaryItems.slice(0, normalizedSecondarySlotCount)
  const hiddenItemCount = Math.max(secondaryItems.length - normalizedSecondarySlotCount, 0)
  const resolvedRootStyle = {
    "--thumbnail-showcase-secondary-slot-count": normalizedSecondarySlotCount,
    ...(width ? { "--thumbnail-showcase-width": normalizeThumbnailShowcaseDimension(width) } : {}),
    ...style,
  } as TThumbnailShowcaseCSSProperties

  return (
    <div {...rootProps} className={classNames(thumbnailShowcase, className)} style={resolvedRootStyle}>
      {showPrimary ? (
        <div className={classNames(thumbnailShowcase__primarySlot, primarySlotClassName)} style={primarySlotStyle}>
          {primaryContent ?? primaryPlaceholder}
        </div>
      ) : null}

      {showSecondary && hasAvailableMedia && normalizedSecondarySlotCount > 0 ? (
        <div className={classNames(thumbnailShowcase__secondaryRow, secondaryRowClassName)} style={secondaryRowStyle}>
          {Array.from({ length: normalizedSecondarySlotCount }).map((_, index) => {
            const item = visibleSecondaryItems[index]
            const isOverflowSlot = index === normalizedSecondarySlotCount - 1 && hiddenItemCount > 0 && renderOverflow

            return (
              <div
                key={item?.id ?? `thumbnail-showcase-placeholder-${index}`}
                className={classNames(thumbnailShowcase__secondarySlot, secondarySlotClassName)}
                style={secondarySlotStyle}
              >
                {isOverflowSlot
                  ? renderOverflow({ hiddenItemCount })
                  : (item?.content ?? renderSecondaryPlaceholder?.({ index }))}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default ThumbnailShowcase
