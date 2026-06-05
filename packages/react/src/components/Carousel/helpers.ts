import classNames from "classnames"
import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel"
import {
  createContext,
  useCallback,
  useContext,
  type ComponentType,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type KeyboardEventHandler,
  type PropsWithoutRef,
  type ReactNode,
  type RefAttributes,
} from "react"

import styles from "./CarouselStyles.module.css"

export const CAROUSEL_SLIDE_ALIGNMENT__START = "start"
export const CAROUSEL_SLIDE_ALIGNMENT__CENTER = "center"
export const CAROUSEL_SLIDE_ALIGNMENT__END = "end"
export const AVAILABLE_CAROUSEL_SLIDE_ALIGNMENTS = [
  CAROUSEL_SLIDE_ALIGNMENT__START,
  CAROUSEL_SLIDE_ALIGNMENT__CENTER,
  CAROUSEL_SLIDE_ALIGNMENT__END,
] as const

export const CAROUSEL_ALIGNMENT_AXIS__X = "x"
export const CAROUSEL_ALIGNMENT_AXIS__Y = "y"
export const AVAILABLE_CAROUSEL_ALIGNMENT_AXES = [CAROUSEL_ALIGNMENT_AXIS__X, CAROUSEL_ALIGNMENT_AXIS__Y] as const

export const CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT = "viewport"
export const CAROUSEL_KEYBOARD_NAV_TARGET__ROOT = "root"
export const AVAILABLE_CAROUSEL_KEYBOARD_NAV_TARGETS = [
  CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT,
  CAROUSEL_KEYBOARD_NAV_TARGET__ROOT,
] as const

export const CAROUSEL_CHROME_OVERLAY_STRATEGY__OVERLAY = "overlay"
export const CAROUSEL_CHROME_OVERLAY_STRATEGY__NONE = "none"
export const AVAILABLE_CAROUSEL_CHROME_OVERLAY_STRATEGIES = [
  CAROUSEL_CHROME_OVERLAY_STRATEGY__OVERLAY,
  CAROUSEL_CHROME_OVERLAY_STRATEGY__NONE,
] as const

export const CAROUSEL_CHROME_SLOT__PREV = "prev"
export const CAROUSEL_CHROME_SLOT__NEXT = "next"
export const CAROUSEL_CHROME_SLOT__CLOSE = "close"
export const CAROUSEL_CHROME_SLOT__DOTS = "dots"
export const CAROUSEL_CHROME_SLOT__COUNTER = "counter"

export const AVAILABLE_CAROUSEL_CHROME_SLOTS = [
  CAROUSEL_CHROME_SLOT__PREV,
  CAROUSEL_CHROME_SLOT__NEXT,
  CAROUSEL_CHROME_SLOT__CLOSE,
  CAROUSEL_CHROME_SLOT__DOTS,
  CAROUSEL_CHROME_SLOT__COUNTER,
] as const

export const DEFAULT_CAROUSEL_ALIGNMENT_AXIS = CAROUSEL_ALIGNMENT_AXIS__X
export const DEFAULT_CAROUSEL_ALIGNMENT = CAROUSEL_SLIDE_ALIGNMENT__CENTER
export const DEFAULT_CAROUSEL_ITEM_INDEX = 0
export const DEFAULT_CAROUSEL_LOOP_ENABLED = true
export const DEFAULT_CAROUSEL_AUTOPLAY_ENABLED = false
export const DEFAULT_CAROUSEL_KEYBOARD_NAV_STATUS = true
export const DEFAULT_ENABLE_HOME_END_KEYS_STATUS = true
export const DEFAULT_CAROUSEL_KEYBOARD_NAV_TARGET = CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT
export const DEFAULT_CAROUSEL_ARIA_LABEL = "Content Carousel"
export const DEFAULT_CAROUSEL_CHROME_OVERLAY_STRATEGY = CAROUSEL_CHROME_OVERLAY_STRATEGY__OVERLAY

type TClampArgs = {
  number: number
  min: number
  max: number
}

export const clamp = ({ number, min, max }: TClampArgs) => Math.max(min, Math.min(max, number))

export type TCarouselItemAlignment = (typeof AVAILABLE_CAROUSEL_SLIDE_ALIGNMENTS)[number]
export type TCarouselAlignmentAxis = (typeof AVAILABLE_CAROUSEL_ALIGNMENT_AXES)[number]
export type TCarouselKeyboardNavTarget = (typeof AVAILABLE_CAROUSEL_KEYBOARD_NAV_TARGETS)[number]
export type TCarouselChromeOverlayStrategy = (typeof AVAILABLE_CAROUSEL_CHROME_OVERLAY_STRATEGIES)[number]
export type TCarouselChromeSlot = (typeof AVAILABLE_CAROUSEL_CHROME_SLOTS)[number]

export type TCarouselChromeRenderArgs = {
  context: TCarouselContext
  slot: TCarouselChromeSlot
}

export type TBaseCarouselItem = { ID?: string | number; publicId?: string | number }

export type TCarouselRenderArgs<TItem> = {
  item: TItem
  index: number
  isSelected: boolean
}

export type TCarouselItemPositionLabelArgs = {
  itemNumber: number
  itemCount: number
}

export type TCarouselRootLabels = {
  ariaLabel: string
  ariaRoleDescription: string
  liveRegionText: (args: TCarouselItemPositionLabelArgs) => string
}

export type TCarouselItemLabels = {
  ariaRoleDescription: string
  ariaLabel: (args: TCarouselItemPositionLabelArgs) => string
}

export type TCarouselControlLabels = {
  previousItemButtonAriaLabel: string
  nextItemButtonAriaLabel: string
  closeButtonAriaLabel: string
}

export type TCarouselDotsLabels = {
  navigationAriaLabel: string
  dotButtonLabel: (args: TCarouselItemPositionLabelArgs) => string
}

export type TCarouselCounterLabels = {
  ariaLabel: string
  counterText: string
}

export type TCarouselLabels = {
  root: TCarouselRootLabels
  item: TCarouselItemLabels
  controls: TCarouselControlLabels
  dots: TCarouselDotsLabels
  counter: TCarouselCounterLabels
}

export type TPartialCarouselLabels = {
  [TGroup in keyof TCarouselLabels]?: Partial<TCarouselLabels[TGroup]>
}

export const DEFAULT_CAROUSEL_LABELS: TCarouselLabels = {
  root: {
    ariaLabel: DEFAULT_CAROUSEL_ARIA_LABEL,
    ariaRoleDescription: "carousel",
    liveRegionText: ({ itemNumber, itemCount }) => `Item ${itemNumber} of ${itemCount}`,
  },
  item: {
    ariaRoleDescription: "slide",
    ariaLabel: ({ itemNumber, itemCount }) => `Item ${itemNumber} of ${itemCount}`,
  },
  controls: {
    previousItemButtonAriaLabel: "Previous Item",
    nextItemButtonAriaLabel: "Next Item",
    closeButtonAriaLabel: "Close Carousel",
  },
  dots: {
    navigationAriaLabel: "Slide Navigation",
    dotButtonLabel: ({ itemNumber, itemCount }) => `Go to item ${itemNumber} of ${itemCount}`,
  },
  counter: {
    ariaLabel: "Carousel Counter",
    counterText: "Items",
  },
}

export type TCarouselControlComponentProps = {
  onPress?: () => void
  isDisabled?: boolean
  "aria-label"?: string
  labels?: Partial<TCarouselControlLabels>
  className?: string
  customClassName?: string
  style?: CSSProperties
  customStyles?: CSSProperties
}

export type TCarouselControlComponent = ForwardRefExoticComponent<
  PropsWithoutRef<TCarouselControlComponentProps> & RefAttributes<HTMLButtonElement>
>

export type TChromeVisualComponent<P> = ComponentType<
  Partial<P> & { customClassName?: string; customStyles?: CSSProperties }
>

export type TCarouselChrome = ReactNode | ((args: TCarouselChromeRenderArgs) => ReactNode)

export type TCarouselContext = {
  emblaApi: EmblaCarouselType | null
  selectedIndex: number
  itemCount: number
  canScrollPrev: boolean
  canScrollNext: boolean
  scrollPrev: () => void
  scrollNext: () => void
  scrollTo: (index: number) => void
  getItemIDForIndex: (index: number) => string
  labels: TCarouselLabels
}

export type TCarouselState = {
  selectedIndex: number
  canScrollPrev: boolean
  canScrollNext: boolean
  autoPlayEnabled: boolean
}

export const initState: TCarouselState = {
  selectedIndex: DEFAULT_CAROUSEL_ITEM_INDEX,
  canScrollPrev: false,
  canScrollNext: false,
  autoPlayEnabled: false,
}

export type TCarouselProps<TItem extends TBaseCarouselItem> = {
  "data-testid"?: string
  items: TItem[]
  initialIndex?: number
  loopEnabled?: boolean
  autoPlayEnabled?: boolean
  axis?: TCarouselAlignmentAxis
  align?: TCarouselItemAlignment
  chromeSlot?: TCarouselChrome
  chromeOverlayStrategy?: TCarouselChromeOverlayStrategy
  enableKeyboardNavigation?: boolean
  keyboardNavigationTarget?: TCarouselKeyboardNavTarget
  enableHomeEndKeys?: boolean
  ariaLabel?: string
  labels?: TPartialCarouselLabels
  dialogTitleID?: string
  onViewportRefChange?: (el: HTMLDivElement | null) => void
  renderCarouselItem: (args: TCarouselRenderArgs<TItem>) => ReactNode
  onIndexChange?: (index: number) => void
  getItemID?: (index: number) => string
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
  customViewportClassName?: string
  customViewportStyles?: CSSProperties
  customContainerClassName?: string
  customContainerStyles?: CSSProperties
  customItemClassName?: string
  customItemStyles?: CSSProperties
  customChromeClassName?: string
  customChromeStyles?: CSSProperties
}

type TCalibratedCarouselComponent = {
  carouselStyles: string
  carouselStyle: CSSProperties
  viewportStyles: string
  viewportStyle: CSSProperties
  containerStyles: string
  containerStyle: CSSProperties
  chromeStyles: string
  chromeStyle: CSSProperties
  itemStyles: string
  itemStyle: CSSProperties
}

export const CarouselContext = createContext<TCarouselContext | null>(null)

export const useCarouselContext = () => {
  const context = useContext(CarouselContext)
  if (!context)
    throw new Error(
      "A problem was encountered while trying to use the carousel context. useCarouselContext must be used within <Carousel>",
    )

  return context
}

export const computeEmblaOptions = <TItem extends TBaseCarouselItem>(
  props: TCarouselProps<TItem>,
): EmblaOptionsType => {
  const {
    loopEnabled = DEFAULT_CAROUSEL_LOOP_ENABLED,
    axis = DEFAULT_CAROUSEL_ALIGNMENT_AXIS,
    align = DEFAULT_CAROUSEL_ALIGNMENT,
  } = props
  const direction = axis === CAROUSEL_ALIGNMENT_AXIS__X ? CAROUSEL_ALIGNMENT_AXIS__X : CAROUSEL_ALIGNMENT_AXIS__Y

  return {
    loop: loopEnabled,
    axis: direction,
    align,
    dragFree: false,
    skipSnaps: false,
  }
}

export const resolveCarouselLabels = (props: {
  ariaLabel?: string
  labels?: TPartialCarouselLabels
}): TCarouselLabels => {
  const { ariaLabel, labels } = props

  return {
    root: {
      ...DEFAULT_CAROUSEL_LABELS.root,
      ...labels?.root,
      ariaLabel: labels?.root?.ariaLabel ?? ariaLabel ?? DEFAULT_CAROUSEL_LABELS.root.ariaLabel,
    },
    item: {
      ...DEFAULT_CAROUSEL_LABELS.item,
      ...labels?.item,
    },
    controls: {
      ...DEFAULT_CAROUSEL_LABELS.controls,
      ...labels?.controls,
    },
    dots: {
      ...DEFAULT_CAROUSEL_LABELS.dots,
      ...labels?.dots,
    },
    counter: {
      ...DEFAULT_CAROUSEL_LABELS.counter,
      ...labels?.counter,
    },
  }
}

export const useHandleKeyDown = <TItem extends TBaseCarouselItem>(args: {
  emblaApi: EmblaCarouselType | undefined
  alignmentAxis?: TCarouselAlignmentAxis
  enableKeyboardNavigation?: boolean
  enableHomeEndKeys?: boolean
  items: TItem[]
}) => {
  const {
    emblaApi,
    alignmentAxis = DEFAULT_CAROUSEL_ALIGNMENT_AXIS,
    enableKeyboardNavigation,
    enableHomeEndKeys,
    items,
  } = args

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (!enableKeyboardNavigation || !emblaApi) return

      const target = event.target as HTMLElement
      const isTextField =
        ["INPUT", "TEXTAREA"].includes(target.tagName) || target.getAttribute("contenteditable") === "true"
      if (isTextField || event.altKey || event.ctrlKey || event.metaKey) return

      const key = event.key

      if (alignmentAxis === CAROUSEL_ALIGNMENT_AXIS__X) {
        if (key === "ArrowLeft") {
          event.preventDefault()
          emblaApi.scrollPrev()
        } else if (key === "ArrowRight") {
          event.preventDefault()
          emblaApi.scrollNext()
        }
      }

      if (alignmentAxis === CAROUSEL_ALIGNMENT_AXIS__Y) {
        if (key === "ArrowUp") {
          event.preventDefault()
          emblaApi.scrollPrev()
        } else if (key === "ArrowDown") {
          event.preventDefault()
          emblaApi.scrollNext()
        }
      }

      if (enableHomeEndKeys) {
        if (key === "Home") {
          event.preventDefault()
          emblaApi.scrollTo(0)
        } else if (key === "End") {
          event.preventDefault()
          emblaApi.scrollTo(items.length - 1)
        }
      }
    },
    [enableKeyboardNavigation, emblaApi, alignmentAxis, enableHomeEndKeys, items.length],
  )

  return handleKeyDown
}

export const calibrateComponent = <TItem extends TBaseCarouselItem>(
  props: TCarouselProps<TItem>,
): TCalibratedCarouselComponent => {
  const {
    className,
    style,
    customClassName,
    customStyles,
    customViewportClassName,
    customViewportStyles,
    customContainerClassName,
    customContainerStyles,
    customItemClassName,
    customItemStyles,
    customChromeClassName,
    customChromeStyles,
  } = props
  const { carousel, carousel__viewport, carousel__container, carousel__item, carousel__chrome } = styles

  const carouselStyles = classNames(carousel, customClassName, className)
  const viewportStyles = classNames(carousel__viewport, customViewportClassName)
  const containerStyles = classNames(carousel__container, customContainerClassName)
  const chromeStyles = classNames(carousel__chrome, customChromeClassName)
  const itemStyles = classNames(carousel__item, customItemClassName)
  const carouselStyle = { ...customStyles, ...style }
  const viewportStyle = { ...customViewportStyles }
  const containerStyle = { ...customContainerStyles }
  const chromeStyle = { ...customChromeStyles }
  const itemStyle = { ...customItemStyles }

  return {
    carouselStyles,
    carouselStyle,
    viewportStyles,
    viewportStyle,
    containerStyles,
    containerStyle,
    chromeStyles,
    chromeStyle,
    itemStyles,
    itemStyle,
  }
}
