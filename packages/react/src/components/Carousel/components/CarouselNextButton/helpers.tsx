import type { TButtonProps } from "../../../Button/helpers"
import type { TCarouselControlLabels } from "../../helpers"

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
