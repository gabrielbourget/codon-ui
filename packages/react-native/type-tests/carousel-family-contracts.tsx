import { createRef } from "react"
import { PlatformColor, StyleSheet, View } from "react-native"

import {
  Carousel,
  CarouselCounter,
  CarouselDots,
  CarouselNextButton,
  CarouselPrevButton,
  type CarouselProps,
  type TNativeCarouselScrollOptions,
} from "../src"

const styles = StyleSheet.create({ viewport: { width: "100%" }, item: { flexBasis: "50%" } })
export const props: CarouselProps<{ ID: string; title: string }> = {
  items: [{ ID: "first", title: "First" }],
  axis: "y",
  align: "end",
  autoPlayEnabled: true,
  initialIndex: 0,
  customStyles: { color: PlatformColor("labelColor"), fontSize: 20 },
  customChromeStyles: { color: "purple", fontWeight: "bold" },
  customViewportStyles: styles.viewport,
  customItemStyles: [styles.item, { backgroundColor: PlatformColor("labelColor") }],
  onViewportRefChange: (node) => {
    const native: View | null = node
    void native
  },
  renderCarouselItem: ({ item, index, isSelected }) => <View testID={`${item.title}:${index}:${isSelected}`} />,
  chromeSlot: ({ context, slot }) => {
    const options: TNativeCarouselScrollOptions = { animated: false }
    context.scrollTo(0, options)
    context.scrollNext()
    context.scrollPrev(options)
    // @ts-expect-error The raw Embla engine was retired by the finite native paging amendment.
    void context.emblaApi
    void slot
    return (
      <>
        <CarouselPrevButton ref={createRef<View>()} />
        <CarouselNextButton />
        <CarouselDots activationMode="manual" />
        <CarouselCounter
          customCounterProps={{ ariaDescribedBy: "description", ariaDetails: "details", value: "001" }}
        />
      </>
    )
  },
}
export const Family = <Carousel {...props} />
const incompatible = [{ ID: 0, title: "First" }]
// @ts-expect-error Generic item values retain their exact owner type.
export const WrongItem = <Carousel {...props} items={incompatible} />
type TBrowserDiv = HTMLDivElement & { querySelector: (selector: string) => unknown }
// @ts-expect-error Original native viewport refs cannot become DOM refs.
export const DomRef = <Carousel {...props} onViewportRefChange={(node: TBrowserDiv | null) => void node} />
// @ts-expect-error CSS strings are not native style owners.
export const Css = <Carousel {...props} customContainerStyles="display: flex" />
// @ts-expect-error Continuous looping is outside the approved finite native paging contract.
export const Continuous = <Carousel {...props} loopEnabled />
// @ts-expect-error Native command options do not expose Embla physics or observer switches.
export const EngineOptions: TNativeCarouselScrollOptions = { watchDrag: false }
// @ts-expect-error The retired raw engine type is no longer public.
export type { TNativeCarouselApi } from "../src"
// @ts-expect-error The retired plugin contract is no longer public.
export type { TNativeCarouselPlugin } from "../src"
// @ts-expect-error The retired engine options are no longer public.
export type { TNativeCarouselOptions } from "../src"
// @ts-expect-error The retired engine event bus is no longer public.
export type { TNativeCarouselEvent } from "../src"
