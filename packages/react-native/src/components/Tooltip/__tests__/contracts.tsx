import { createRef } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeTooltipTrigger } from "../../../overlays/floating/NativeTooltipTrigger"
import { Button } from "../../Button/Button"
import { HoverPopover } from "../../HoverPopover/HoverPopover"
import { NativeTooltipContext } from "../context"
import { Tooltip } from "../Tooltip"

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

export const renderedTooltip = (
  <Tooltip
    render={(props, state) => {
      state.state.open(true)
      state.state.close(false)
      // @ts-expect-error Tooltip state does not expose Popover's trigger name.
      void state.trigger
      return <NativeFocusView {...props} />
    }}
  />
)
export const inheritedTooltip = (
  <NativeTooltipContext.Provider value={{ placement: "bottom", style: { opacity: 0 } }}>
    <HoverPopover slot={null} />
  </NativeTooltipContext.Provider>
)
// @ts-expect-error the approved description root cannot become a keyboard focus target
export const noFocusableTooltip = <Tooltip focusable />
// @ts-expect-error the original description host must remain retained for measurement and metadata
export const noCollapsedTooltip = <Tooltip collapsable />
// @ts-expect-error the wrapper retains ReactNode children rather than calling a child renderer
export const noChildRenderer = <Tooltip>{() => "Content"}</Tooltip>
// @ts-expect-error the native renderer returns an actual host element
export const noMissingTooltipHost = <Tooltip render={() => null} />
