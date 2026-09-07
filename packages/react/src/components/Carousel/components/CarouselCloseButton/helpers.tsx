import type { TButtonProps } from "../../../Button/helpers"
import type { TCarouselControlLabels } from "../../helpers"

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
