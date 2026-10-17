import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Image, Pressable, View, type ImageStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { useNativeControlHitSlop, useNativeSelectionInteraction } from "../selection"
import { Text } from "../Text/Text"

import { getNativeAvatarName, getNativeAvatarStyle } from "./styles"
import type { TNativeAvatarProps, TNativeAvatarRef, TNativeAvatarRootStyle } from "./types"

const AvatarGraphic = ({
  uri,
  imageStyle,
  fallback,
}: {
  uri?: string
  imageStyle: ImageStyle
  fallback: ReactNode
}) => {
  const [loaded, setLoaded] = useState(false)
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return (
    <>
      {uri ? (
        <Image
          source={{ uri }}
          testID="avatar-image"
          accessible={false}
          importantForAccessibility="no"
          resizeMode="contain"
          style={[imageStyle, !loaded && { opacity: 0, position: "absolute" }]}
          onLoad={() => {
            if (mounted.current) setLoaded(true)
          }}
          onError={() => {
            if (mounted.current) setLoaded(false)
          }}
        />
      ) : null}
      {!loaded && fallback}
    </>
  )
}

export const Avatar = forwardRef<TNativeAvatarRef, TNativeAvatarProps>((props, ref) => {
  const {
    size: _size,
    color: _color,
    foreground: _foreground,
    background: _background,
    geometry: _geometry,
    raised: _raised,
    customStyles: _customStyles,
    style: _style,
    imageURL,
    name1,
    name2,
    labels,
    fallbackDelay,
    clickable = false,
    disabled = false,
    customImageStyles,
    customFallbackStyles,
    customTextStyles,
    customTextProps = {},
    accessible = true,
    accessibilityLabel,
    accessibilityState,
    "aria-label": aliasLabel,
    testID,
    "data-testid": aliasTestID,
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    onHoverIn,
    onHoverOut,
    onFocus,
    onBlur,
    onLayout,
    hitSlop,
    ...rest
  } = props
  const theme = useNativeTheme()
  const isInteractive = clickable && typeof onPress === "function"
  const isDisabled = disabled ?? false
  const interaction = useNativeSelectionInteraction(
    { onPress, onPressIn, onPressOut, onLongPress, onHoverIn, onHoverOut, onFocus, onBlur },
    isDisabled || !isInteractive,
    false,
    () => undefined,
  )
  const { isPressed, isHovered, isFocused } = interaction.flags
  const resolved = getNativeAvatarStyle(theme, props, {
    isInteractive,
    isDisabled,
    isPressed,
    isHovered,
    isFocused,
  })
  const target = useNativeControlHitSlop(onLayout, hitSlop)
  const [canRenderFallback, setCanRenderFallback] = useState(fallbackDelay === undefined)
  useEffect(() => {
    if (fallbackDelay === undefined) return
    const timer = setTimeout(() => setCanRenderFallback(true), fallbackDelay)
    return () => clearTimeout(timer)
  }, [fallbackDelay])
  const { initials, name } = getNativeAvatarName(name1, name2, labels)
  const { color: fallbackColor, ...fallbackStyle } = resolveNativeStyle<TNativeAvatarRootStyle>(
    [{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }, customFallbackStyles],
    "Avatar",
    "customFallbackStyles",
  )
  const imageStyle = resolveNativeStyle<ImageStyle>(
    [
      {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        borderRadius: resolved.viewStyle.borderRadius,
      },
      customImageStyles,
    ],
    "Avatar",
    "customImageStyles",
  )
  validateNativeColor(imageStyle.tintColor, "Avatar", "customImageStyles.tintColor")
  validateNativeColor(imageStyle.overlayColor, "Avatar", "customImageStyles.overlayColor")
  const { customStyles: textCustomStyles, ...textProps } = customTextProps
  const fallback = canRenderFallback ? (
    <View
      testID="avatar-fallback"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={fallbackStyle}
    >
      <NativeContentContext.Provider
        value={{ foregroundColor: fallbackColor ?? resolved.foregroundColor, isButton: true }}
      >
        <Text {...textProps} accessible={false} selectable={false} customStyles={[textCustomStyles, customTextStyles]}>
          {initials}
        </Text>
      </NativeContentContext.Provider>
    </View>
  ) : null
  return (
    <Pressable
      {...rest}
      {...interaction.handlers}
      ref={ref}
      accessible={accessible}
      role={isInteractive ? "button" : "img"}
      disabled={!isInteractive || isDisabled}
      focusable={isInteractive && !isDisabled}
      aria-disabled={isInteractive ? isDisabled : undefined}
      accessibilityState={{ ...accessibilityState, disabled: isInteractive ? isDisabled : undefined }}
      accessibilityLabel={accessibilityLabel ?? aliasLabel ?? name}
      testID={testID ?? aliasTestID ?? "avatar"}
      onLayout={target.onLayout}
      hitSlop={isInteractive ? target.hitSlop : undefined}
      style={resolved.viewStyle}
    >
      <AvatarGraphic key={imageURL ?? ""} uri={imageURL} imageStyle={imageStyle} fallback={fallback} />
    </Pressable>
  )
})
Avatar.displayName = "Avatar"
