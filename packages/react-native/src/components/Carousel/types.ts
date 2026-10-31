import type { TNativeButtonProps, TNativeButtonRef } from "../Button/types"

export type TNativeCarouselControlLabels = Readonly<{
  previousItemButtonAriaLabel: string
  nextItemButtonAriaLabel: string
  closeButtonAriaLabel: string
}>
export type TNativeCarouselCloseButtonRef = TNativeButtonRef
export type TNativeCarouselCloseButtonProps = TNativeButtonProps & {
  labels?: Pick<TNativeCarouselControlLabels, "closeButtonAriaLabel">
  customButtonProps?: Partial<TNativeButtonProps>
}
export type TNativeCarouselPrevButtonProps = TNativeButtonProps & {
  labels?: Pick<TNativeCarouselControlLabels, "previousItemButtonAriaLabel">
  customButtonProps?: Partial<TNativeButtonProps>
}
export type TNativeCarouselNextButtonProps = TNativeButtonProps & {
  labels?: Pick<TNativeCarouselControlLabels, "nextItemButtonAriaLabel">
  customButtonProps?: Partial<TNativeButtonProps>
}
