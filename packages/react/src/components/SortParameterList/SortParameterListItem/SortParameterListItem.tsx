import { motion } from "motion/react"
import { type ComponentType, type FC, type HTMLAttributes, useRef } from "react"
import type { DragOptions, DropOptions } from "react-aria"
import { useDrag, useDrop } from "react-aria"

import Text from "../../Text/Text"

import SortParameterListItemDefaultDragIndicatorIcon from "./DefaultDragIndicatorIcon"
import { calibrateComponent, type TSortParameterProps } from "./helpers"

const MotionDiv = motion.div as ComponentType<Record<string, unknown>>

const SortParameterListItem: FC<TSortParameterProps> = (props) => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabel: ariaLabelAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    className,
    customClassName,
    customIconClassName,
    customIconStyles,
    customStyles,
    customTextClassName,
    customTextStyles,
    item,
    onDragStart,
    onDragEnd,
    onDrop,
    style,
    ...rest
  } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const {
    sortParameterListItemStyles,
    sortParameterListItemStyle,
    sortParameterListItemIconStyles,
    sortParameterListItemTextStyles,
  } = calibrateComponent({
    ...props,
    className,
    customClassName,
    customIconClassName,
    customStyles,
    customTextClassName,
    style,
  })

  const dragOptions: DragOptions = {
    onDragStart: () => onDragStart(item.ID),
    onDragEnd,
    getItems: () => [{ "text/plain": item.ID }],
  }

  const { dragProps, isDragging } = useDrag(dragOptions)

  const dropOptions: DropOptions = {
    ref,
    onDrop: () => onDrop(item.ID),
  }

  const { dropProps } = useDrop(dropOptions)
  const { onDrag: _motionIncompatibleDragHandler, ...motionSafeDragProps } = dragProps as HTMLAttributes<HTMLDivElement>
  const { onDrag: _motionIncompatibleDropHandler, ...motionSafeDropProps } = dropProps as HTMLAttributes<HTMLDivElement>

  return (
    <MotionDiv
      {...rest}
      {...motionSafeDragProps}
      {...motionSafeDropProps}
      data-dragging={isDragging || undefined}
      // - TODO: -> Add sort direction to aria label once that info is tracked by the component.
      aria-label={ariaLabel ?? ariaLabelAlias ?? `Sort Parameter - ${item.name}`}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      ref={ref}
      id={item.ID}
      className={sortParameterListItemStyles}
      data-testid={dataTestID ?? "sort-parameter-list-item"}
      style={sortParameterListItemStyle}
      layout
      whileDrag={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 50 }}
    >
      <span
        className={sortParameterListItemIconStyles}
        data-testid="sort-parameter-list-item-icon"
        style={customIconStyles}
      >
        <SortParameterListItemDefaultDragIndicatorIcon
          size={10}
          data-testid="sort-parameter-list-item-default-drag-indicator-icon"
        />
      </span>
      <Text customClassName={sortParameterListItemTextStyles} customStyles={customTextStyles}>
        {item.name}
      </Text>
    </MotionDiv>
  )
}

export default SortParameterListItem
