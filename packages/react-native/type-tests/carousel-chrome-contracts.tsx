import { createRef } from "react"
import { StyleSheet, type View } from "react-native"

import { CarouselCloseButton, type CarouselCloseButtonProps, type TNativeCarouselCloseButtonRef } from "../src"

const style = StyleSheet.create({ control: { padding: 0 } })
export const closeProps: CarouselCloseButtonProps = {
  labels: { closeButtonAriaLabel: "" },
  children: 0,
  isDisabled: false,
  isPending: false,
  customStyles: [style.control, { width: 0, height: 0 }],
  customButtonProps: {
    geometry: "orthogonal",
    onPress: (event) => {
      const x: number = event.nativeEvent.pageX
      void x
    },
    style: (state) => [state.defaultStyle, { opacity: state.isDisabled ? 0.4 : 1 }],
  },
}
export const Close = <CarouselCloseButton {...closeProps} ref={createRef<TNativeCarouselCloseButtonRef>()} />
export const NativeViewRef = <CarouselCloseButton ref={createRef<View>()} />
// @ts-expect-error CSS strings are not native style objects.
export const CssStyle = <CarouselCloseButton customStyles="padding: 0" />
// @ts-expect-error Native controls retain native View refs.
export const DomRef = <CarouselCloseButton ref={createRef<HTMLButtonElement>()} />
// @ts-expect-error Web click events do not replace native press events.
export const DomEvent = <CarouselCloseButton onPress={(event: React.MouseEvent<HTMLButtonElement>) => void event} />
// @ts-expect-error The full carousel root is not implemented by this chrome checkpoint.
export { Carousel } from "../src"
// @ts-expect-error Context-dependent controls remain private until root construction.
export { CarouselPrevButton } from "../src"
// @ts-expect-error Context-dependent controls remain private until root construction.
export { CarouselNextButton } from "../src"
