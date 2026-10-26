import type { View } from "react-native"

import EmblaCarousel from "../engine/EmblaCarousel"
import {
  createNativeCarouselEnvironment,
  createNativeCarouselEvents,
  type TNativeCarouselNodeBinding,
  type TNativeCarouselWindowState,
} from "../engine/nativeEnvironment"
import type { NodeRectType } from "../engine/NodeRects"
import type { EmblaOptionsType } from "../engine/Options"

export const engineFixture = (sizes: number[], options: EmblaOptionsType = {}) => {
  const axis = options.axis ?? "x"
  const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
  let serial = 0,
    time = 1,
    active = true
  const frame = (receive: Parameters<typeof requestAnimationFrame>[0]) => {
    frames.set(++serial, receive)
    return serial
  }
  const cancel: typeof cancelAnimationFrame = (id) => {
    if (id !== null && id !== undefined) frames.delete(id)
  }
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation(frame)
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(cancel)
  const events = createNativeCarouselEvents()
  let state: TNativeCarouselWindowState = {
    windowId: "window",
    epoch: 1,
    width: 300,
    height: 200,
    scale: 1,
    fontScale: 1,
    isRTL: false,
    colorScheme: "light",
    reducedMotion: false,
  }
  const nodes: TNativeCarouselNodeBinding[] = []
  const host = (start: number, size: number) => {
    const isSlide = nodes.length >= 2
    let translation = 0
    const source = createNativeCarouselEvents()
    const node = {
      offsetTop: axis === "y" ? start : 0,
      offsetLeft: axis === "x" ? start : 0,
      offsetWidth: axis === "x" ? size : 200,
      offsetHeight: axis === "y" ? size : 200,
      offsetParent: {},
      setNativeProps: jest.fn((props: { style: { transform: Record<string, number>[] } }) => {
        translation = props.style.transform.reduce(
          (value, entry) => value + (entry[axis === "x" ? "translateX" : "translateY"] ?? 0),
          0,
        )
      }),
      getBoundingClientRect: (): NodeRectType => {
        const parentShift = isSlide ? translations() : 0
        const left = axis === "x" ? start + translation + parentShift : 0
        const top = axis === "y" ? start + translation + parentShift : 0
        const width = axis === "x" ? size : 200,
          height = axis === "y" ? size : 200
        return { top, left, right: left + width, bottom: top + height, width, height }
      },
    }
    const binding = { node: node as unknown as View, style: () => ({}), events: source, isCurrent: () => true }
    nodes.push(binding)
    return { binding, source, node, translation: () => translation }
  }
  const root = host(0, 300)
  const container = host(0, 300)
  const translations = () => container.translation()
  let cursor = 0
  const slides = sizes.map((size) => {
    const value = host(cursor, size)
    cursor += size
    return value
  })
  const children = () => slides.map(({ binding }) => binding)
  const environment = createNativeCarouselEnvironment({
    nodes: () => ({ root: root.binding, container: { ...container.binding, children }, slides: children() }),
    events,
    window: () => state,
    active: () => active,
  })
  const api = EmblaCarousel(root.binding.node, environment.document, options)
  const advance = (count = 1) => {
    for (let index = 0; index < count; index++) {
      time += 1000 / 60
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((receive) => receive(time))
    }
  }
  return {
    api,
    events,
    root,
    container,
    slides,
    advance,
    frames,
    environment,
    window: (next: Partial<TNativeCarouselWindowState>) => {
      state = { ...state, ...next }
      events.emit("window", state)
    },
    visible: (next: boolean) => {
      active = next
      events.emit("visibility", active)
    },
  }
}

// This is a browser model supplied to the installed, unmodified Embla 8.6.0 oracle.
export const browserEngineFixture = (sizes: number[], options: EmblaOptionsType = {}) => {
  const axis = options.axis ?? "x"
  const noop = () => {}
  class Observer {
    observe = noop
    disconnect = noop
  }
  Object.assign(globalThis, { ResizeObserver: Observer, IntersectionObserver: Observer, MutationObserver: Observer })
  const window = {
    requestAnimationFrame,
    cancelAnimationFrame,
    getComputedStyle: () => ({ getPropertyValue: () => "0px" }),
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    MouseEvent: class {},
  }
  const document = { defaultView: window, addEventListener: noop, removeEventListener: noop, hidden: false }
  Object.assign(globalThis, { document })
  const host = (start: number, size: number) => ({
    ownerDocument: document,
    offsetTop: axis === "y" ? start : 0,
    offsetLeft: axis === "x" ? start : 0,
    offsetWidth: axis === "x" ? size : 200,
    offsetHeight: axis === "y" ? size : 200,
    offsetParent: {},
    style: { transform: "", removeProperty: noop },
    addEventListener: noop,
    removeEventListener: noop,
    getAttribute: () => null,
    removeAttribute: noop,
  })
  let cursor = 0
  const slides = sizes.map((size) => {
    const value = host(cursor, size)
    cursor += size
    return value
  })
  const container = { ...host(0, 300), children: slides }
  const root = { ...host(0, 300), children: [container] }
  const create = jest.requireActual<(node: unknown, options: EmblaOptionsType) => ReturnType<typeof EmblaCarousel>>(
    "../../../../../react/node_modules/embla-carousel",
  )
  return create(root, options)
}
