type TTableFilterPopoverDefaultAddConditionIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "aria-hidden"?: boolean
  "data-testid"?: string
}

const TableFilterPopoverDefaultAddConditionIcon = (props: TTableFilterPopoverDefaultAddConditionIconProps) => {
  const { size, color, customClassName, "aria-hidden": ariaHidden, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number | boolean> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = !color || color === "inherit" ? "currentColor" : color
  if (ariaHidden !== undefined) interpretedProps["aria-hidden"] = ariaHidden
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
    </svg>
  )
}

export default TableFilterPopoverDefaultAddConditionIcon
