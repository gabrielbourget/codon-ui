"use client"

import { forwardRef } from "react"
import { TextArea as AdobeTextArea } from "react-aria-components"

import { calibrateComponent, type TTextAreaProps } from "./helpers"

const TextArea = forwardRef<HTMLTextAreaElement, TTextAreaProps>((props, forwardedRef) => {
  const {
    textSize,
    errorState,
    warningState,
    successState,
    height,
    width,
    isDisabled,
    resize,
    geometry,
    className,
    style,
    customStyles: customStyles__props,
    enableFocusStyle,
    offsetFocusRing,
    "data-testid": dataTestID,
    ...rest
  } = props

  const { textAreaStyles, textAreaStyle } = calibrateComponent(props)

  return (
    <AdobeTextArea
      {...rest}
      disabled={isDisabled}
      ref={forwardedRef}
      className={textAreaStyles}
      style={textAreaStyle}
      data-testid={dataTestID ?? "textarea"}
    />
  )
})

TextArea.displayName = "TextArea"

export default TextArea
