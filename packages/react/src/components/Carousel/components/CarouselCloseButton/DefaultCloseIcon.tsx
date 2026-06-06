type TCarouselDefaultCloseIconProps = {
  size?: number
  color?: string
  customClassName?: string
}

const CarouselDefaultCloseIcon = (props: TCarouselDefaultCloseIconProps) => {
  const { size, color, customClassName } = props
  const interpretedProps: Record<string, string | number> = {}

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = !color || color === "inherit" ? "currentColor" : color

  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

export default CarouselDefaultCloseIcon
