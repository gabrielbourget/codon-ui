import type { TButtonProps } from "../../../Button/helpers"
import type { TCarouselControlLabels } from "../../helpers"

import CarouselDefaultPrevIcon from "./DefaultPrevIcon"

export type TCarouselPrevButtonProps = TButtonProps & {
  customButtonProps?: Partial<TButtonProps>
  labels?: Pick<TCarouselControlLabels, "previousItemButtonAriaLabel">
}

export const defaultButtonProps: Partial<TCarouselPrevButtonProps> = {
  geometry: "round",
  raised: false,
  raisedOnHover: true,
  customStyles: {
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 5,
  },
}

export const calibrateComponent = (_props: TCarouselPrevButtonProps) => {
  const defaultButtonContent = <CarouselDefaultPrevIcon size={20} />

  return { defaultButtonContent }
}
