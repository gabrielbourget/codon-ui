import { type FC } from "react"

import { type TPathProps, computeDashStyle, computePathDescription } from "./helpers"

const Path: FC<TPathProps> = (props) => {
  const { counterClockwise = false, dashRatio, pathRadius, strokeWidth, style, className, ...rest } = props

  return (
    <path
      className={className}
      style={Object.assign({}, style, computeDashStyle({ pathRadius, dashRatio, counterClockwise }))}
      d={computePathDescription({ pathRadius, counterClockwise })}
      strokeWidth={strokeWidth}
      fillOpacity={0}
      {...rest}
    />
  )
}

export default Path
