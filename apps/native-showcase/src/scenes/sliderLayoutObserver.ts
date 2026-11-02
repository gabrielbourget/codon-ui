import { findNodeHandle, type ReadOnlyElement, type View } from "react-native"

type TReadToken = Readonly<{
  isCurrent: () => boolean
  onCancel: (listener: () => void) => () => void
}>

export const SLIDER_LAYOUT_ROOT_ID = "slider-layout-scalar-root"
const failure = (reason: string) => new Error(`Slider layout observer: ${reason}`)
const originalView = (element: ReadOnlyElement): View => {
  if (
    !("measure" in element) ||
    typeof element.measure !== "function" ||
    !("measureInWindow" in element) ||
    typeof element.measureInWindow !== "function" ||
    !("focus" in element) ||
    typeof element.focus !== "function"
  )
    throw failure("original native public instance methods unavailable")
  // Stock View refs and tree traversal share this cached public instance; no wrapper is created.
  return element as View
}

export const acquireSliderLayoutOriginals = (root: View) => {
  if (!root.isConnected || root.id !== SLIDER_LAYOUT_ROOT_ID || !root.ownerDocument)
    throw failure("current original scalar root unavailable")
  const document = root.ownerDocument
  const rootNode = root.getRootNode()
  const visited = new Set<ReadOnlyElement>()
  const pending = [root as ReadOnlyElement]
  const targets: ReadOnlyElement[] = []
  while (pending.length) {
    const element = pending.shift()!
    if (visited.has(element) || visited.size >= 32) throw failure("ambiguous or excessive scalar subtree")
    visited.add(element)
    if (
      !element.isConnected ||
      !root.contains(element) ||
      element.ownerDocument !== document ||
      element.getRootNode() !== rootNode
    )
      throw failure("original subtree document or attachment changed")
    if (element.id.endsWith(":thumb:0")) targets.push(element)
    pending.push(...element.children)
  }
  if (targets.length !== 1) throw failure("unique semantic scalar thumb unavailable")
  const targetElement = targets[0]
  const trackElement = targetElement.parentElement
  if (
    targetElement.tagName !== "RN:CUIFocusView" ||
    !trackElement ||
    trackElement.tagName !== "RN:View" ||
    trackElement.parentElement !== root ||
    root.children.length !== 2 ||
    trackElement.children.length !== 2 ||
    [...trackElement.children].filter((element) => element.tagName === "RN:View").length !== 1
  )
    throw failure("original scalar track and adjustable host structure changed")
  const paints = [...targetElement.children].filter((element) => element.tagName === "RN:View" && !element.id)
  if (
    paints.length !== 1 ||
    targetElement.children.length !== 2 ||
    [...targetElement.children].filter((element) => element.tagName === "RN:CUIFieldBinding").length !== 1 ||
    paints[0].children.length !== 0
  )
    throw failure("unique original passive paint and metadata structure unavailable")
  const target = originalView(targetElement)
  const track = originalView(trackElement)
  const paint = originalView(paints[0])
  const tags = [root, track, target, paint].map((element) => findNodeHandle(element))
  if (tags.some((tag) => !Number.isSafeInteger(tag) || tag === null || tag <= 0) || new Set(tags).size !== 4)
    throw failure("distinct current original native tags unavailable")
  return { root, track, target, paint, targetID: target.id, tags, document, rootNode }
}

const box = (element: ReadOnlyElement) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    throw failure("nonempty actual native bounds unavailable")
  return { x, y, width, height }
}

export const readSliderLayoutOriginalGeometry = async (root: View, token: TReadToken) => {
  const original = acquireSliderLayoutOriginals(root)
  const current = () => {
    if (!token.isCurrent()) return false
    try {
      const next = acquireSliderLayoutOriginals(root)
      return (
        next.document === original.document &&
        next.rootNode === original.rootNode &&
        next.track === original.track &&
        next.target === original.target &&
        next.paint === original.paint &&
        next.targetID === original.targetID &&
        next.tags.every((tag, index) => tag === original.tags[index])
      )
    } catch {
      return false
    }
  }
  if (!current()) throw failure("original instance or preset retired")
  const read = () => ({
    root: box(root),
    track: box(original.track),
    target: box(original.target),
    paint: box(original.paint),
  })
  const viewport = read()
  const rootWindow = await new Promise<ReturnType<typeof box>>((resolve, reject) => {
    let complete = false
    let stop = () => {}
    const finish = (error?: Error, value?: ReturnType<typeof box>) => {
      if (complete) return
      complete = true
      clearTimeout(timer)
      stop()
      if (error) reject(error)
      else if (value) resolve(value)
    }
    const timer = setTimeout(() => finish(failure("original root window measurement exceeded5000ms")), 5000)
    const cancel = token.onCancel(() => finish(failure("original root measurement cancelled")))
    if (complete) cancel()
    else stop = cancel
    try {
      root.measureInWindow((x, y, width, height) => {
        if (!current()) return finish(failure("original instance or preset retired"))
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0)
          return finish(failure("actual original root window frame unavailable"))
        finish(undefined, { x, y, width, height })
      })
    } catch (error) {
      finish(error instanceof Error ? error : failure(String(error)))
    }
  })
  if (
    !current() ||
    JSON.stringify(read()) !== JSON.stringify(viewport) ||
    rootWindow.width !== viewport.root.width ||
    rootWindow.height !== viewport.root.height
  )
    throw failure("actual native layout or original window frame changed during measurement")
  const offset = { x: rootWindow.x - viewport.root.x, y: rootWindow.y - viewport.root.y }
  const windowBox = (rect: ReturnType<typeof box>) => ({ ...rect, x: rect.x + offset.x, y: rect.y + offset.y })
  return {
    coordinateSpace: "stock-native-viewport-bounds-with-original-root-window-offset",
    targetID: original.targetID,
    tags: original.tags,
    viewport,
    rootWindow,
    window: { track: windowBox(viewport.track), target: windowBox(viewport.target), paint: windowBox(viewport.paint) },
    qualification:
      "Actual read-only axis-aligned native bounds; translated-only probe, no transform quad or presentation/window lease claim",
  }
}
