type TNumberInputDefaultIconProps = {
  size?: number
  color?: string
  customClassName?: string
}

const resolveIconStroke = (color: string | undefined) => (!color || color === "inherit" ? "currentColor" : color)

const DefaultDecrementIcon = (props: TNumberInputDefaultIconProps) => {
  const { size, color, customClassName } = props
  const interpretedProps: { height?: number; width?: number; stroke: string } = {
    stroke: resolveIconStroke(color),
  }

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }

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
      <g transform="translate(0,-3)">
        <polyline points="6 9 12 15 18 9"></polyline>
      </g>
    </svg>
  )
}

export default DefaultDecrementIcon
