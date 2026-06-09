type TTimePickerDefaultClockIconProps = {
  size?: number
  color?: string
  customClassName?: string
}

const TimePickerDefaultClockIcon = (props: TTimePickerDefaultClockIconProps) => {
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
      className={customClassName}
      xmlns="http://www.w3.org/2000/svg"
      {...interpretedProps}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export default TimePickerDefaultClockIcon
