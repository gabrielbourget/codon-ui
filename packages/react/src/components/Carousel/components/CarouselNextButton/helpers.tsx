import type { TButtonProps } from "../../../Button/helpers"
import type { TCarouselControlLabels } from "../../helpers"

import CarouselDefaultNextIcon from "./DefaultNextIcon"

export type TCarouselNextButtonProps = TButtonProps & {
  customButtonProps?: Partial<TButtonProps>
  labels?: Pick<TCarouselControlLabels, "nextItemButtonAriaLabel">
}

export const defaultButtonProps: Partial<TCarouselNextButtonProps> = {
  geometry: "round",
  raised: false,
  raisedOnHover: true,
  customStyles: {
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 5,
  },
}

export const calibrateComponent = (_props: TCarouselNextButtonProps) => {
  const defaultButtonContent = <CarouselDefaultNextIcon size={20} />

  return { defaultButtonContent }
}
