import {
  findNodeHandle,
  StyleSheet,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  type PointerEvent,
  type StyleProp,
  type TextStyle,
  type View,
} from "react-native"
// @ts-expect-error RN0.86.3 publishes the inspected original-input registry without declarations.
import upstreamTextInputState from "react-native/Libraries/Components/TextInput/TextInputState"

import type { TNativeFocusWithinEvent } from "../../../input/focusWithin"
import type { TNativeObservedKeyboardEvent } from "../../../input/keyboardObservation"
import type { TNativeWindowPointerEvent } from "../../../input/nativeWindowPointers"
import type { TNativeFocusEvent, TNativeKeyboardEvent } from "../../../input/types"

export type TNativeCarouselNode = View
export type TNativeCarouselPointerEvent = TNativeWindowPointerEvent | PointerEvent | GestureResponderEvent
export type TNativeCarouselWindowState = Readonly<{
  windowId: string
  epoch: number
  width: number
  height: number
  scale: number
  fontScale: number
  isRTL: boolean
  colorScheme: "light" | "dark" | null
  reducedMotion: boolean
}>
export type TNativeCarouselMutation = Readonly<{
  target: TNativeCarouselNode
  previousNodes: readonly TNativeCarouselNode[]
  nodes: readonly TNativeCarouselNode[]
}>
export type TNativeCarouselResizeEntry = Readonly<{
  target: TNativeCarouselNode
  originalEvent: LayoutChangeEvent
}>
export type TNativeCarouselEventMap = {
  pointerDown: TNativeCarouselPointerEvent
  pointerMove: TNativeCarouselPointerEvent
  pointerUp: TNativeCarouselPointerEvent
  pointerCancel: TNativeCarouselPointerEvent
  focus: TNativeFocusWithinEvent | TNativeFocusEvent
  keyDown: TNativeKeyboardEvent | TNativeObservedKeyboardEvent
  keyUp: TNativeKeyboardEvent
  layout: LayoutChangeEvent
  mutations: readonly TNativeCarouselMutation[]
  visibility: boolean
  window: TNativeCarouselWindowState
  geometry: undefined
}
export type TNativeCarouselListenerOptions = Readonly<{ once?: boolean }>
export type TNativeCarouselEventSource = {
  subscribe: <K extends keyof TNativeCarouselEventMap>(
    name: K,
    receive: (event: TNativeCarouselEventMap[K]) => void,
    options?: TNativeCarouselListenerOptions,
  ) => () => void
}
export const createNativeCarouselEvents = () => {
  const listeners = new Map<keyof TNativeCarouselEventMap, Set<(event: never) => void>>()
  const source: TNativeCarouselEventSource & {
    emit: <K extends keyof TNativeCarouselEventMap>(name: K, event: TNativeCarouselEventMap[K]) => void
    clear: () => void
  } = {
    subscribe: (name, receive, options) => {
      let entries = listeners.get(name)
      if (!entries) listeners.set(name, (entries = new Set()))
      const invoke = (event: never) => {
        if (options?.once) entries.delete(invoke)
        receive(event)
      }
      entries.add(invoke)
      return () => entries.delete(invoke)
    },
    emit: (name, event) => {
      // The event name selects its dependent payload type at this one dispatch boundary.
      for (const receive of [...(listeners.get(name) ?? [])]) receive(event as never)
    },
    clear: () => listeners.clear(),
  }
  return source
}
export type TNativeCarouselNodeBinding = Readonly<{
  node: TNativeCarouselNode
  style: () => StyleProp<TextStyle>
  events: TNativeCarouselEventSource
  isCurrent: () => boolean
}>
export type TNativeCarouselContainerBinding = TNativeCarouselNodeBinding &
  Readonly<{
    children: () => readonly TNativeCarouselNodeBinding[]
  }>
export type TNativeCarouselNodeSet = Readonly<{
  root: TNativeCarouselNodeBinding
  container: TNativeCarouselContainerBinding
  slides: readonly TNativeCarouselNodeBinding[]
}>
export type TNativeCarouselDocument = Readonly<{
  root: TNativeCarouselNode
  environment: TNativeCarouselEnvironment
  events: TNativeCarouselEventSource
  hidden: () => boolean
}>
export type TNativeCarouselWindow = Readonly<{
  environment: TNativeCarouselEnvironment
  events: TNativeCarouselEventSource
  state: () => TNativeCarouselWindowState
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
}>
type TNativeCarouselEnvironment = {
  nodes: () => TNativeCarouselNodeSet
  binding: (node: TNativeCarouselNode) => TNativeCarouselNodeBinding
  register: (binding: TNativeCarouselNodeBinding) => void
  geometryChanged: () => void
  margin: (node: TNativeCarouselNode, edge: "left" | "right" | "top" | "bottom") => number
  active: () => boolean
  document: TNativeCarouselDocument
  window: TNativeCarouselWindow
}
type TOptions = {
  nodes: () => TNativeCarouselNodeSet
  window: () => TNativeCarouselWindowState
  active: () => boolean
  events: ReturnType<typeof createNativeCarouselEvents>
}
const textInputs: { isTextInput: (node: object) => boolean } = upstreamTextInputState
const nativeFieldNames = new Set(["CUIDateSegment"])
export const nativeCarouselEditableTarget = (target: unknown) =>
  !!target &&
  typeof target === "object" &&
  (textInputs.isTextInput(target) || ("tagName" in target && nativeFieldNames.has(String(target.tagName))))

export const nativeCarouselPointer = (event: TNativeCarouselPointerEvent) => {
  const data = event.nativeEvent
  if ("pointerId" in data) return data
  const touch = data.changedTouches[0] ?? data
  return {
    pageX: touch.pageX,
    pageY: touch.pageY,
    pointerId: Number(touch.identifier),
    pointerType: "touch",
    isPrimary: data.touches.length <= 1,
    button: 0,
    buttons: data.touches.length ? 1 : 0,
  }
}
export const nativeCarouselPointerTime = (event: TNativeCarouselPointerEvent) =>
  "registrations" in event.nativeEvent ? event.nativeEvent.timestamp : event.timeStamp
export const nativeCarouselPointerTarget = (event: TNativeCarouselPointerEvent, root: TNativeCarouselNode) => {
  if (!("registrations" in event.nativeEvent) && event.target && typeof event.target === "object") return event.target
  const target = "registrations" in event.nativeEvent ? event.nativeEvent.target : event.target
  const pending: unknown[] = [root]
  while (pending.length) {
    const node = pending.pop()
    if (!node || typeof node !== "object") continue
    if ("measure" in node && findNodeHandle(node as TNativeCarouselNode) === target) return node
    if (
      "childNodes" in node &&
      node.childNodes &&
      typeof node.childNodes === "object" &&
      Symbol.iterator in node.childNodes
    )
      pending.push(...Array.from(node.childNodes as Iterable<unknown>))
  }
  return null
}

// Bind genuine hosts and native observations; browser EventTarget dispatch is default-off in pinned RN.
export const createNativeCarouselEnvironment = (options: TOptions): TNativeCarouselEnvironment => {
  const bindings = new WeakMap<TNativeCarouselNode, TNativeCarouselNodeBinding>()
  const register = (binding: TNativeCarouselNodeBinding) => bindings.set(binding.node, binding)
  const binding = (node: TNativeCarouselNode) => {
    const retained = bindings.get(node)
    if (retained) return retained
    const current = options.nodes()
    for (const entry of [current.root, current.container, ...current.slides]) register(entry)
    const value = bindings.get(node)
    if (!value) throw new TypeError("Carousel: custom native nodes require an original-node/style/event binding")
    return value
  }
  const environment: TNativeCarouselEnvironment = {
    nodes: options.nodes,
    binding,
    register,
    geometryChanged: () => options.events.emit("geometry", undefined),
    active: options.active,
    margin: (node, edge) => {
      const style = StyleSheet.flatten(binding(node).style()) ?? {}
      const read = (name: string): unknown => Reflect.get(style, name)
      const rtl = read("direction") === "rtl" || (read("direction") !== "ltr" && options.window().isRTL)
      const horizontal = edge === "left" || edge === "right"
      const start = edge === (rtl ? "right" : "left")
      const value =
        (horizontal ? read(start ? "marginStart" : "marginEnd") : undefined) ??
        read(`margin${edge[0].toUpperCase()}${edge.slice(1)}`) ??
        read(horizontal ? "marginHorizontal" : "marginVertical") ??
        read("margin") ??
        0
      if (typeof value === "number" && Number.isFinite(value)) return value
      if (value === "auto") return 0
      if (typeof value === "string" && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(value)) {
        const parent = options.nodes().container.node
        const width = "offsetWidth" in parent ? parent.offsetWidth : undefined
        if (typeof width === "number" && Number.isFinite(width)) return (Number.parseFloat(value) * width) / 100
      }
      throw new TypeError("Carousel: native slide margins must resolve to finite logical dimensions")
    },
    document: {
      root: options.nodes().root.node,
      get environment() {
        return environment
      },
      events: options.events,
      hidden: () => !options.active(),
    },
    window: {
      get environment() {
        return environment
      },
      events: options.events,
      state: options.window,
      requestAnimationFrame,
      cancelAnimationFrame,
    },
  }
  return environment
}
