type TPaginationDefaultIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "data-testid"?: string
}

const resolveIconColor = (color: string | undefined) => (!color || color === "inherit" ? "currentColor" : color)

export const PaginationDefaultChevronLeftIcon = (props: TPaginationDefaultIconProps) => {
  const { size, color, customClassName, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.stroke = resolveIconColor(color)
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

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

export const PaginationDefaultChevronRightIcon = (props: TPaginationDefaultIconProps) => {
  const { size, color, customClassName, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.stroke = resolveIconColor(color)
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

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

export const PaginationDefaultDoubleChevronLeftIcon = (props: TPaginationDefaultIconProps) => {
  const { size, color, customClassName, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = resolveIconColor(color)
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

  return (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M28,0c.44,0,.89.17,1.23.51.68.68.68,1.78,0,2.46l-12.03,12.03,12.03,12.03c.68.68.68,1.78,0,2.46-.68.68-1.78.68-2.46,0l-13.26-13.26c-.68-.68-.68-1.78,0-2.46L26.77.51C27.11.17,27.55,0,28,0Z" />
      <path d="M15,0c.44,0,.89.17,1.23.51.68.68.68,1.78,0,2.46L4.19,15l12.03,12.03c.68.68.68,1.78,0,2.46-.68.68-1.78.68-2.46,0L.51,16.23c-.68-.68-.68-1.78,0-2.46L13.77.51C14.11.17,14.55,0,15,0Z" />
    </svg>
  )
}

export const PaginationDefaultDoubleChevronRightIcon = (props: TPaginationDefaultIconProps) => {
  const { size, color, customClassName, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = resolveIconColor(color)
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

  return (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M1.74,30c-.44,0-.89-.17-1.23-.51-.68-.68-.68-1.78,0-2.46l12.03-12.03L.51,2.97C-.17,2.29-.17,1.19.51.51,1.19-.17,2.29-.17,2.97.51l13.26,13.26c.68.68.68,1.78,0,2.46L2.97,29.49c-.34.34-.78.51-1.23.51Z" />
      <path d="M14.74,30c-.44,0-.89-.17-1.23-.51-.68-.68-.68-1.78,0-2.46l12.03-12.03L13.51,2.97c-.68-.68-.68-1.78,0-2.46.68-.68,1.78-.68,2.46,0l13.26,13.26c.68.68.68,1.78,0,2.46l-13.26,13.26c-.34.34-.78.51-1.23.51Z" />
    </svg>
  )
}

export const PaginationDefaultOverflowIcon = (props: TPaginationDefaultIconProps) => {
  const { size, color, customClassName, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number> = {}
  const fillColor = resolveIconColor(color)

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = fillColor
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

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
