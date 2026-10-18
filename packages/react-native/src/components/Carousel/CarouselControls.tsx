import { forwardRef } from "react"

import { Button } from "../Button/Button"
import type { TNativeButtonProps, TNativeButtonRef } from "../Button/types"

import { DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS, useNativeCarouselControlsContext } from "./context"
import { NativeCarouselControlIcon } from "./icons"
import type {
  TNativeCarouselCloseButtonProps,
  TNativeCarouselNextButtonProps,
  TNativeCarouselPrevButtonProps,
} from "./types"

type TControlSurfaceProps = TNativeButtonProps & {
  customButtonProps?: Partial<TNativeButtonProps>
  defaultLabel: string
  defaultDisabled?: boolean
  defaultPress?: TNativeButtonProps["onPress"]
  kind: "close" | "previous" | "next"
}
const ControlSurface = forwardRef<TNativeButtonRef, TControlSurfaceProps>((props, ref) => {
  const { children, customStyles, customButtonProps, defaultLabel, defaultDisabled, defaultPress, kind, ...rest } =
    props
  const { customStyles: innerStyles, ...innerProps } = customButtonProps ?? {}
  return (
    <Button
      ref={ref}
      onPress={defaultPress}
      isDisabled={defaultDisabled}
      aria-label={defaultLabel}
      geometry="round"
      raised={false}
      raisedOnHover
      {...rest}
      {...innerProps}
      customStyles={[
        { backgroundColor: "rgba(0,0,0,0.75)", padding: 5, paddingHorizontal: undefined },
        customStyles,
        innerStyles,
      ]}
    >
      {children ?? <NativeCarouselControlIcon kind={kind} />}
    </Button>
  )
})
ControlSurface.displayName = "CarouselControlSurface"

export const CarouselCloseButton = forwardRef<TNativeButtonRef, TNativeCarouselCloseButtonProps>((props, ref) => {
  const { labels, ...buttonProps } = props
  return (
    <ControlSurface
      {...buttonProps}
      ref={ref}
      kind="close"
      defaultLabel={labels?.closeButtonAriaLabel ?? DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS.closeButtonAriaLabel}
    />
  )
})
CarouselCloseButton.displayName = "CarouselCloseButton"

export const CarouselPrevButton = forwardRef<TNativeButtonRef, TNativeCarouselPrevButtonProps>((props, ref) => {
  const { labels, ...buttonProps } = props
  const context = useNativeCarouselControlsContext()
  return (
    <ControlSurface
      {...buttonProps}
      ref={ref}
      kind="previous"
      defaultLabel={labels?.previousItemButtonAriaLabel ?? context.labels.previousItemButtonAriaLabel}
      defaultDisabled={!context.canScrollPrev}
      defaultPress={context.scrollPrev}
    />
  )
})
CarouselPrevButton.displayName = "CarouselPrevButton"

export const CarouselNextButton = forwardRef<TNativeButtonRef, TNativeCarouselNextButtonProps>((props, ref) => {
  const { labels, ...buttonProps } = props
  const context = useNativeCarouselControlsContext()
  return (
    <ControlSurface
      {...buttonProps}
      ref={ref}
      kind="next"
      defaultLabel={labels?.nextItemButtonAriaLabel ?? context.labels.nextItemButtonAriaLabel}
      defaultDisabled={!context.canScrollNext}
      defaultPress={context.scrollNext}
    />
  )
})
CarouselNextButton.displayName = "CarouselNextButton"
