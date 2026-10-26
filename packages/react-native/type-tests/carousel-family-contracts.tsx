import { createRef } from "react"
import { PlatformColor, StyleSheet, View } from "react-native"

import {
  Carousel,
  CarouselCounter,
  CarouselDots,
  CarouselNextButton,
  CarouselPrevButton,
  type CarouselProps,
  type TNativeCarouselApi,
  type TNativeCarouselOptions,
  type TNativeCarouselPlugin,
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
    const api: TNativeCarouselApi | null = context.emblaApi
    const plugin: TNativeCarouselPlugin = {
      name: "owned",
      options: {},
      init: (owner) => {
        const node: View = owner.rootNode()
        void node
      },
      destroy: () => {},
    }
    const options: TNativeCarouselOptions = {
      align: (view, snap, index) => (view - snap) / (index + 1),
      breakpoints: { large: { when: (window) => window.width > 600, options: { loop: false } } },
      container: (nodes) => nodes.container,
      slides: () => [],
    }
    api?.reInit(options, [plugin])
    api?.on("select", (owner, event) => {
      const root: View = owner.rootNode()
      void [root, event]
    })
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
// @ts-expect-error DOM query strings do not describe native original-node bindings.
export const DomSelector: TNativeCarouselOptions = { container: ".container" }
// @ts-expect-error Browser MediaQueryList strings cannot replace native window predicates.
export const DomBreakpoint: TNativeCarouselOptions = { breakpoints: { "(min-width: 600px)": { loop: false } } }
// @ts-expect-error Browser elements are not native nodes returned by the complete engine.
export const DomNode: ReturnType<TNativeCarouselApi["rootNode"]> = {} as HTMLDivElement
