import type { CSSProperties } from "react"

import type { TCounterProps } from "../../../Counter/helpers"
import type { TTextProps } from "../../../Text/helpers"
import type { TCarouselCounterLabels } from "../../helpers"

export type TCarouselCounterProps = {
  counterText?: string
  labels?: Partial<TCarouselCounterLabels>
  className?: string
  style?: CSSProperties
  customCounterProps?: Partial<TCounterProps>
  customTextProps?: Partial<TTextProps>
  customCounterClassName?: string
  customCounterTextClassName?: string
  customTextClassName?: string
  customClassName?: string
  customCounterStyles?: CSSProperties
  customTextStyles?: CSSProperties
  customStyles?: CSSProperties
}
