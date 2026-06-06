type TSelectDefaultChevronDownIconProps = {
  size?: number
  color?: string
  customClassName?: string
}

const SelectDefaultChevronDownIcon = (props: TSelectDefaultChevronDownIconProps) => {
  const { size, color, customClassName } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.stroke = !color || color === "inherit" ? "currentColor" : color

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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default SelectDefaultChevronDownIcon
