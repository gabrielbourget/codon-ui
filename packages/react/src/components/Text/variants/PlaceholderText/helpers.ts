import classNames from "classnames"
import type { PropsWithChildren } from "react"

import type { TTextProps } from "../../helpers"

import styles from "./PlaceholderTextStyles.module.css"

export const PLACEHOLDER_TEXT_ALIGNMENT__LEFT = "left"
export const PLACEHOLDER_TEXT_ALIGNMENT__CENTER = "center"

export const AVAILABLE_PLACEHOLDER_TEXT_ALIGNMENTS = [
  PLACEHOLDER_TEXT_ALIGNMENT__LEFT,
  PLACEHOLDER_TEXT_ALIGNMENT__CENTER,
] as const

export type TPlaceholderTextAlignment = (typeof AVAILABLE_PLACEHOLDER_TEXT_ALIGNMENTS)[number]

export type TPlaceholderTextProps = PropsWithChildren<
  Omit<TTextProps, "color" | "fontStyle" | "fontWeight" | "variant"> & {
    "data-testid"?: string
    align?: TPlaceholderTextAlignment
  }
>

export const calibrateComponent = (props: TPlaceholderTextProps) => {
  const { align = PLACEHOLDER_TEXT_ALIGNMENT__LEFT, customClassName } = props
  const alignmentStyles =
    align === PLACEHOLDER_TEXT_ALIGNMENT__CENTER
      ? styles["placeholderText--alignCenter"]
      : styles["placeholderText--alignLeft"]

  return {
    placeholderTextStyles: classNames(styles.placeholderText, alignmentStyles, customClassName),
  }
}
