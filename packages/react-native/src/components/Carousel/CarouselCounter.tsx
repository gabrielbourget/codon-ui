import { View } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { Counter } from "../Counter/Counter"
import { Text } from "../Text/Text"

import { useNativeCarouselContext } from "./CarouselContext"
import type { TNativeCarouselCounterProps } from "./carouselTypes"

export const CarouselCounter = (props: TNativeCarouselCounterProps) => {
  const context = useNativeCarouselContext()
  const theme = useNativeTheme()
  const counterText = props.counterText ?? props.labels?.counterText ?? context.labels.counter.counterText
  const ariaLabel = props.labels?.ariaLabel ?? context.labels.counter.ariaLabel
  const style = resolveNativeStyle(
    [
      {
        padding: theme.spacing.unit,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10000,
        position: "relative",
      },
      props.customStyles,
      props.style,
    ],
    "CarouselCounter",
    "style",
  )
  const radii = Object.fromEntries(Object.entries(style).filter(([key]) => /^border.*Radius$/.test(key)))
  return (
    <View testID="carousel-counter" style={style}>
      <View
        testID="carousel-counter-surface"
        pointerEvents="none"
        accessible={false}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          ...radii,
          backgroundColor: theme.colors.controlBackground,
          opacity: 0.75,
        }}
      />
      <Counter
        aria-label={ariaLabel}
        value={context.selectedIndex + 1}
        maxValue={context.itemCount}
        showMaxValue
        customStyles={props.customCounterStyles}
        {...props.customCounterProps}
      >
        {counterText ? (
          <Text customStyles={props.customTextStyles} {...props.customTextProps}>
            {counterText}
          </Text>
        ) : null}
      </Counter>
    </View>
  )
}
