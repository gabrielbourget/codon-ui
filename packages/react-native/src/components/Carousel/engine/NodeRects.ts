import type { TNativeCarouselNode } from "./nativeEnvironment"

export type NodeRectType = { top: number; right: number; bottom: number; left: number; width: number; height: number }
export type NodeRectsType = { measure: (node: TNativeCarouselNode) => NodeRectType }

// Pinned Fabric hosts expose these synchronous, untransformed native layout getters.
export const NodeRects = (): NodeRectsType => ({
  measure: (node) => {
    const read = (name: string) => {
      const value: unknown = Reflect.get(node, name)
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new TypeError("Carousel: layout requires a current original Fabric host")
      return value
    }
    const top = read("offsetTop"),
      left = read("offsetLeft"),
      width = read("offsetWidth"),
      height = read("offsetHeight")
    return { top, right: left + width, bottom: top + height, left, width, height }
  },
})
