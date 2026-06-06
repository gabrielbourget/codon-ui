import type { TButtonProps } from "../../../Button/helpers"
import type { TCarouselControlLabels } from "../../helpers"

import CarouselDefaultCloseIcon from "./DefaultCloseIcon"

export type TCarouselCloseButtonProps = TButtonProps & {
  customButtonProps?: Partial<TButtonProps>
  labels?: Pick<TCarouselControlLabels, "closeButtonAriaLabel">
}

export const defaultButtonProps: Partial<TCarouselCloseButtonProps> = {
  geometry: "round",
  raised: false,
  raisedOnHover: true,
  customStyles: {
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 5,
  },
}

export const calibrateComponent = (_props: TCarouselCloseButtonProps) => {
  const defaultButtonContent = <CarouselDefaultCloseIcon size={20} />

  return { defaultButtonContent }
}
