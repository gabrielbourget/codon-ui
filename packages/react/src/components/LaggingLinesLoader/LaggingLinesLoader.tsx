"use client"

import type { CSSProperties, FC, PropsWithChildren } from "react"

import { calibrateComponent, formatDimension, type TLaggingLinesLoaderProps } from "./helpers"

const LaggingLinesLoader: FC<PropsWithChildren<TLaggingLinesLoaderProps>> = (props) => {
  const { width = 150 } = props
  const { loaderStyles, loadingSlideStyles, slideStyles, customStyles } = calibrateComponent(props)

  return (
    <div className={loaderStyles} style={{ "--width": formatDimension(width) } as CSSProperties}>
      <div className={loadingSlideStyles}>
        <div style={{ ...customStyles }} className={slideStyles}></div>
        <div style={{ ...customStyles }} className={slideStyles}></div>
        <div style={{ ...customStyles }} className={slideStyles}></div>
      </div>
    </div>
  )
}

export default LaggingLinesLoader
