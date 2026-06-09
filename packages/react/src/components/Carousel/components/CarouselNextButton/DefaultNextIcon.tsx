type TCarouselDefaultNextIconProps = {
  size?: number
  color?: string
  customClassName?: string
}

const CarouselDefaultNextIcon = (props: TCarouselDefaultNextIconProps) => {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default CarouselDefaultNextIcon
