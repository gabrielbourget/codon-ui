import { createRef } from "react"
import type { View } from "react-native"

import { NativeTooltipTrigger, Button, HoverPopover, Tooltip, type TooltipProps, type HoverPopoverProps } from "../src"

const nativeRef = createRef<View>()
export const explicitNativeTrigger = (
  <NativeTooltipTrigger
    isOpen={false}
    delay={0}
    closeDelay={0}
    isDisabled
    triggerMode="focus"
    shouldCloseOnPress={false}
    trigger={(state) => (
      <Button {...state.triggerProps} onPress={(event) => event.persist()}>
        Action
      </Button>
    )}
  >
    <Tooltip
      ref={nativeRef}
      triggerRef={nativeRef}
      boundaryRef={nativeRef}
      width={0}
      maxHeight={0}
      customStyles={{
        fontSize: 0,
        filter: [{ dropShadow: { offsetX: 0, offsetY: 0, standardDeviation: 0, color: "red" } }],
      }}
      customOverlayArrowStyles={{ fill: "orange", fillOpacity: 0, width: 0 }}
      onPointerEnter={(event) => {
        event.persist()
        event.nativeEvent.pointerType.toLowerCase()
      }}
    >
      Description
    </Tooltip>
  </NativeTooltipTrigger>
)
export const hoverSurface = <HoverPopover ref={nativeRef} geometry="orthogonal" showOverlayArrow />
// @ts-expect-error Tooltip semantics do not expose a modal dialog owner.
export const noDialog = <Tooltip childIsDialog />
// @ts-expect-error Tooltip semantics remain nonmodal without an owner-controlled modality switch.
export const noModality = <HoverPopover isNonModal />
// @ts-expect-error There is no owned dialog style slot.
export const noDialogStyle = <Tooltip customDialogStyles={{ padding: 0 }} />
// @ts-expect-error The canonical Tooltip PositionProps do not expose a scrollRef.
export const noScrollRef = <Tooltip scrollRef={nativeRef} />
// @ts-expect-error The owned root style is a native style object/array, not a DOM CSS callback.
export const noStyleCallback = <Tooltip style={() => ({ padding: 0 })} />
// @ts-expect-error Native anchors must support actual native measurement.
export const noDOMAnchor = <Tooltip triggerRef={createRef<{ getBoundingClientRect: () => void }>()} />

export const typedTooltip: TooltipProps = { isOpen: false, offset: 0 }
export const typedHover: HoverPopoverProps = { isOpen: false, showOverlayArrow: false }
// @ts-expect-error Browser CSS class overrides map to native style slots.
export const noClass = <Tooltip className="tooltip" />
// @ts-expect-error Native refs retain View methods.
export const noDOMRef = <HoverPopover ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Descriptions observe actual native anchors, not virtual measurement objects.
export const noVirtualAnchor = <Tooltip triggerRef={createRef<Pick<View, "measureInWindow">>()} />
