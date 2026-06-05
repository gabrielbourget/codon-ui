type TBreadcrumbDefaultIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "aria-hidden"?: boolean
}

const resolveIconColor = (color: string | undefined) => (!color || color === "inherit" ? "currentColor" : color)

export const BreadcrumbDefaultChevronRightIcon = (props: TBreadcrumbDefaultIconProps) => {
  const { size, color, customClassName, "aria-hidden": ariaHidden } = props
  const interpretedProps: Record<string, string | number | boolean> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.stroke = resolveIconColor(color)
  if (ariaHidden !== undefined) interpretedProps["aria-hidden"] = ariaHidden

  return (
    <svg
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={customClassName}
      {...interpretedProps}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export const BreadcrumbDefaultOverflowIcon = (props: TBreadcrumbDefaultIconProps) => {
  const { size, color, customClassName, "aria-hidden": ariaHidden } = props
  const interpretedProps: Record<string, string | number | boolean> = {}
  const fillColor = resolveIconColor(color)

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = fillColor
  if (ariaHidden !== undefined) interpretedProps["aria-hidden"] = ariaHidden

  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path fill="none" d="M0 0h24v24H0z" />
      <path
        fill={fillColor}
        d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
      />
    </svg>
  )
}
