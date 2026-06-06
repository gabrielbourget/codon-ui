type TDateTimePickerDefaultIconProps = {
  size?: number
  color?: string
  customClassName?: string
}

const resolveIconColor = (color: string | undefined) => (!color || color === "inherit" ? "currentColor" : color)

export const DateTimePickerDefaultCalendarIcon = (props: TDateTimePickerDefaultIconProps) => {
  const { size, color, customClassName } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = resolveIconColor(color)

  return (
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M112 880c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V460H112v420zm768-696H712v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H384v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H144c-17.7 0-32 14.3-32 32v176h800V216c0-17.7-14.3-32-32-32z" />
    </svg>
  )
}

export const DateTimePickerDefaultChevronLeftIcon = (props: TDateTimePickerDefaultIconProps) => {
  const { size, color, customClassName } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.stroke = resolveIconColor(color)

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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export const DateTimePickerDefaultChevronRightIcon = (props: TDateTimePickerDefaultIconProps) => {
  const { size, color, customClassName } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.stroke = resolveIconColor(color)

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
