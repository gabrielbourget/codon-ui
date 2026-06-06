type TSortParameterListItemDefaultDragIndicatorIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "aria-hidden"?: boolean
  "data-testid"?: string
}

const SortParameterListItemDefaultDragIndicatorIcon = (props: TSortParameterListItemDefaultDragIndicatorIconProps) => {
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
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M13.5 26.25C13.5 28.3125 11.8125 30 9.75 30C7.6875 30 6 28.3125 6 26.25C6 24.1875 7.6875 22.5 9.75 22.5C11.8125 22.5 13.5 24.1875 13.5 26.25ZM9.75 11.25C7.6875 11.25 6 12.9375 6 15C6 17.0625 7.6875 18.75 9.75 18.75C11.8125 18.75 13.5 17.0625 13.5 15C13.5 12.9375 11.8125 11.25 9.75 11.25ZM9.75 0C7.6875 0 6 1.6875 6 3.75C6 5.8125 7.6875 7.5 9.75 7.5C11.8125 7.5 13.5 5.8125 13.5 3.75C13.5 1.6875 11.8125 0 9.75 0ZM21 7.5C23.0625 7.5 24.75 5.8125 24.75 3.75C24.75 1.6875 23.0625 0 21 0C18.9375 0 17.25 1.6875 17.25 3.75C17.25 5.8125 18.9375 7.5 21 7.5ZM21 11.25C18.9375 11.25 17.25 12.9375 17.25 15C17.25 17.0625 18.9375 18.75 21 18.75C23.0625 18.75 24.75 17.0625 24.75 15C24.75 12.9375 23.0625 11.25 21 11.25ZM21 22.5C18.9375 22.5 17.25 24.1875 17.25 26.25C17.25 28.3125 18.9375 30 21 30C23.0625 30 24.75 28.3125 24.75 26.25C24.75 24.1875 23.0625 22.5 21 22.5Z" />
    </svg>
  )
}

export default SortParameterListItemDefaultDragIndicatorIcon
