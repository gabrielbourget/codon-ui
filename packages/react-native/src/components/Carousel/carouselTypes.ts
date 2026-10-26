import type { ReactNode, ForwardRefExoticComponent, PropsWithoutRef, RefAttributes } from "react"
import type { StyleProp, View, ViewStyle } from "react-native"

import type { TNativeButtonProps } from "../Button/types"
import type { TNativeCounterProps } from "../Counter/types"
import type { TNativeTextProps } from "../Text/types"

import type { TNativeCarouselDotsActivationMode } from "./dotsModel"
import type { EmblaCarouselType } from "./engine/EmblaCarousel"
import type { TNativeCarouselControlLabels } from "./types"

export type TNativeBaseCarouselItem = { ID?: string | number; publicId?: string | number }
export type TNativeCarouselPosition = { itemNumber: number; itemCount: number }
export type TNativeCarouselLabels = {
  root: {
    ariaLabel: string
    ariaRoleDescription: string
    liveRegionText: (position: TNativeCarouselPosition) => string
  }
  item: { ariaRoleDescription: string; ariaLabel: (position: TNativeCarouselPosition) => string }
  controls: TNativeCarouselControlLabels
  dots: { navigationAriaLabel: string; dotButtonLabel: (position: TNativeCarouselPosition) => string }
  counter: { ariaLabel: string; counterText: string }
}
export type TNativePartialCarouselLabels = { [K in keyof TNativeCarouselLabels]?: Partial<TNativeCarouselLabels[K]> }
export type TNativeCarouselContext = {
  emblaApi: EmblaCarouselType | null
  selectedIndex: number
  itemCount: number
  canScrollPrev: boolean
  canScrollNext: boolean
  scrollPrev: () => void
  scrollNext: () => void
  scrollTo: (index: number) => void
  getItemIDForIndex: (index: number) => string
  labels: TNativeCarouselLabels
}
export type TNativeCarouselControlComponentProps = TNativeButtonProps & {
  labels?: Partial<TNativeCarouselControlLabels>
}
export type TNativeCarouselControlComponent = ForwardRefExoticComponent<
  PropsWithoutRef<TNativeCarouselControlComponentProps> & RefAttributes<View>
>
export const NATIVE_CAROUSEL_AXES = ["x", "y"] as const
export const NATIVE_CAROUSEL_ALIGNMENTS = ["start", "center", "end"] as const
export const NATIVE_CAROUSEL_KEYBOARD_TARGETS = ["viewport", "root"] as const
export const NATIVE_CAROUSEL_CHROME_STRATEGIES = ["overlay", "none"] as const
export const NATIVE_CAROUSEL_CHROME_SLOTS = ["prev", "next", "close", "dots", "counter"] as const
export type TNativeCarouselChromeSlot = (typeof NATIVE_CAROUSEL_CHROME_SLOTS)[number]
export type TNativeCarouselProps<TItem extends TNativeBaseCarouselItem> = {
  testID?: string
  "data-testid"?: string
  items: TItem[]
  initialIndex?: number
  loopEnabled?: boolean
  autoPlayEnabled?: boolean
  axis?: (typeof NATIVE_CAROUSEL_AXES)[number]
  align?: (typeof NATIVE_CAROUSEL_ALIGNMENTS)[number]
  chromeSlot?:
    | ReactNode
    | ((args: { context: TNativeCarouselContext; slot: TNativeCarouselChromeSlot | "custom" }) => ReactNode)
  chromeOverlayStrategy?: (typeof NATIVE_CAROUSEL_CHROME_STRATEGIES)[number]
  enableKeyboardNavigation?: boolean
  keyboardNavigationTarget?: (typeof NATIVE_CAROUSEL_KEYBOARD_TARGETS)[number]
  enableHomeEndKeys?: boolean
  ariaLabel?: string
  labels?: TNativePartialCarouselLabels
  dialogTitleID?: string
  onViewportRefChange?: (node: View | null) => void
  renderCarouselItem: (args: { item: TItem; index: number; isSelected: boolean }) => ReactNode
  onIndexChange?: (index: number) => void
  getItemID?: (index: number) => string
  style?: StyleProp<ViewStyle>
  customStyles?: StyleProp<ViewStyle>
  customViewportStyles?: StyleProp<ViewStyle>
  customContainerStyles?: StyleProp<ViewStyle>
  customItemStyles?: StyleProp<ViewStyle>
  customChromeStyles?: StyleProp<ViewStyle>
}
export type TNativeCarouselDotsProps = {
  interactive?: boolean
  activationMode?: TNativeCarouselDotsActivationMode
  maxVisible?: number
  showOverflowSentinels?: boolean
  ariaLabel?: string
  labels?: Partial<TNativeCarouselLabels["dots"]>
  raised?: boolean
  style?: StyleProp<ViewStyle>
  customStyles?: StyleProp<ViewStyle>
  testID?: string
}
export type TNativeCarouselCounterProps = {
  counterText?: string
  labels?: Partial<TNativeCarouselLabels["counter"]>
  style?: StyleProp<ViewStyle>
  customStyles?: StyleProp<ViewStyle>
  customCounterProps?: Partial<TNativeCounterProps>
  customTextProps?: Partial<TNativeTextProps>
  customCounterStyles?: TNativeCounterProps["customStyles"]
  customTextStyles?: TNativeTextProps["customStyles"]
}
