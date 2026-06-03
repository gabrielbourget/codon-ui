type TTagDefaultCloseIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "aria-hidden"?: boolean
  "data-testid"?: string
}

const resolveIconColor = (color: string | undefined) => (!color || color === "inherit" ? "currentColor" : color)

const TagDefaultCloseIcon = (props: TTagDefaultCloseIconProps) => {
  const { size, color, customClassName, "aria-hidden": ariaHidden, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number | boolean> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = resolveIconColor(color)
  if (ariaHidden !== undefined) interpretedProps["aria-hidden"] = ariaHidden
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

export default TagDefaultCloseIcon
