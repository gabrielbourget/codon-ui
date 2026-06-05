type TFilterClauseRowDefaultDeleteIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "aria-hidden"?: boolean
  "data-testid"?: string
}

const FilterClauseRowDefaultDeleteIcon = (props: TFilterClauseRowDefaultDeleteIconProps) => {
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
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.4615 4.61538H27.3846V6.92308H25.0769V27.6923L22.7692 30H6.61538L4.30769 27.6923V6.92308H2V4.61538H8.92308V2.30769C8.92308 1.69565 9.16621 1.10868 9.59898 0.675907C10.0318 0.243131 10.6187 0 11.2308 0H18.1538C18.7659 0 19.3529 0.243131 19.7856 0.675907C20.2184 1.10868 20.4615 1.69565 20.4615 2.30769V4.61538ZM18.1538 2.30769H11.2308V4.61538H18.1538V2.30769ZM6.61538 27.6923H22.7692V6.92308H6.61538V27.6923ZM11.2308 9.23077H8.92308V25.3846H11.2308V9.23077ZM13.5385 9.23077H15.8462V25.3846H13.5385V9.23077ZM18.1538 9.23077H20.4615V25.3846H18.1538V9.23077Z"
      />
    </svg>
  )
}

export default FilterClauseRowDefaultDeleteIcon
