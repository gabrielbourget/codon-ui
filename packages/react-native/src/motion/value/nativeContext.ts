import type { ColorValue, View } from "react-native"

import { sampleNativeMotionColors } from "../../input/motionColors"

import type { TNativeMotionValueContext } from "./types"

export const createNativeMotionValueContext = (
  options: Omit<TNativeMotionValueContext, "resolveColors"> & { target: () => View | null },
): TNativeMotionValueContext => ({
  ...options,
  resolveColors: async (colors, token) => {
    const target = options.target()
    if (!target || !token.isCurrent()) throw new Error("Native motion: actual native color owner unavailable")
    const result = await sampleNativeMotionColors(target, colors as readonly ColorValue[], token)
    if (!token.isCurrent() || target !== options.target())
      throw new Error("Native motion: native color resolution retired")
    return result.colors.map(
      ({ red, green, blue, alpha }) => `rgba(${red * 255}, ${green * 255}, ${blue * 255}, ${alpha})`,
    )
  },
})
