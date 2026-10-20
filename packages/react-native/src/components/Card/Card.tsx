import { forwardRef } from "react"

import { NativeMotionOwnerHost } from "../../motion/owner/NativeMotionOwnerHost"
import type { TNativeMotionOwnerHostProps } from "../../motion/owner/NativeMotionOwnerHost"
import { useNativeTheme } from "../../theme"

import { splitNativeCardMotionProps } from "./motionProps"
import { getNativeCardStyle } from "./styles"
import type { TNativeCardProps, TNativeCardRef } from "./types"

// Private construction only: full native drawing, measurement and installed acceptance remain required.
export const Card = forwardRef<TNativeCardRef, TNativeCardProps>((props, ref) => {
  const theme = useNativeTheme()
  const {
    width,
    height,
    borderRadius,
    raised,
    layoutMode,
    customStyles,
    style,
    children,
    values,
    transformTemplate,
    onUpdate,
    testID,
    "data-testid": testAlias,
    ...rest
  } = props
  const { motion, nativeProps } = splitNativeCardMotionProps(rest)
  return (
    <NativeMotionOwnerHost
      {...nativeProps}
      ref={ref}
      testID={testID ?? testAlias}
      motion={{ ...motion, layout: layoutMode }}
      // The owner erases value generics internally; keep the original caller-owned objects.
      values={values as TNativeMotionOwnerHostProps["values"]}
      computedStyles={getNativeCardStyle({ width, height, borderRadius, raised, layoutMode }, theme)}
      customStyles={customStyles}
      style={style}
      transformTemplate={transformTemplate}
      onUpdate={onUpdate}
    >
      {children}
    </NativeMotionOwnerHost>
  )
})
Card.displayName = "Card"
