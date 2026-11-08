import type { View } from "react-native"

import {
  acquireSliderLayoutOriginals,
  readSliderLayoutOriginalGeometry,
  SLIDER_LAYOUT_ROOT_ID,
} from "../sliderLayoutObserver"

// These native-host models discriminate acquisition/retirement guards; they are not native measurements.
const harness = () => {
  const document = {}
  const tagByNode = new Map<unknown, number>()
  const element = (tag: number, tagName: string, id = "") => {
    const node = {
      id,
      tagName,
      isConnected: true,
      ownerDocument: document,
      parentElement: null as unknown,
      children: [] as unknown[],
      getRootNode: () => document,
      contains: (other: unknown): boolean =>
        node === other || node.children.some((child) => (child as typeof node).contains(other)),
      measure: jest.fn(),
      measureInWindow: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) => callback(20, 40, 300, 76)),
      focus: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({ x: 10, y: 30, width: 300, height: 76 })),
    }
    tagByNode.set(node, tag)
    return node
  }
  const root = element(1, "RN:View", SLIDER_LAYOUT_ROOT_ID)
  const header = element(2, "RN:View")
  const track = element(3, "RN:View")
  const rail = element(4, "RN:View")
  const target = element(5, "RN:CUIFocusView", "fixture:thumb:0")
  const paint = element(6, "RN:View")
  const metadata = element(7, "RN:CUIFieldBinding")
  const append = (parent: typeof root, ...children: (typeof root)[]) => {
    parent.children.push(...children)
    children.forEach((child) => {
      child.parentElement = parent
    })
  }
  append(root, header, track)
  append(track, rail, target)
  append(target, paint, metadata)
  track.getBoundingClientRect.mockReturnValue({ x: 10, y: 58, width: 300, height: 48 })
  target.getBoundingClientRect.mockReturnValue({ x: 196, y: 70, width: 24, height: 24 })
  paint.getBoundingClientRect.mockReturnValue({ x: 196, y: 70, width: 24, height: 24 })
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((node) => tagByNode.get(node) ?? null)
  let active = true
  const listeners = new Set<() => void>()
  const token = {
    isCurrent: () => active,
    onCancel: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    root,
    track,
    target,
    paint,
    metadata,
    tagByNode,
    append,
    element,
    token,
    listeners,
    originalRoot: root as unknown as View,
    cancel: () => {
      active = false
      ;[...listeners].forEach((listener) => listener())
    },
  }
}

afterEach(() => jest.restoreAllMocks())

it("retains cached original nodes and returns their measured translated bounds with actual root-window offset", async () => {
  const h = harness()
  const first = acquireSliderLayoutOriginals(h.originalRoot)
  const second = acquireSliderLayoutOriginals(h.originalRoot)
  expect(first.target).toBe(h.target)
  expect(second.paint).toBe(first.paint)
  const receipt = await readSliderLayoutOriginalGeometry(h.originalRoot, h.token)
  expect(receipt.tags).toEqual([1, 3, 5, 6])
  expect(receipt.viewport.target).toEqual({ x: 196, y: 70, width: 24, height: 24 })
  expect(receipt.window.paint).toEqual({ x: 206, y: 80, width: 24, height: 24 })
  expect(receipt.rootWindow).toEqual({ x: 20, y: 40, width: 300, height: 76 })
  expect(h.listeners.size).toBe(0)
})

it("rejects duplicate semantic IDs, wrong host classes and ambiguous passive paint without choosing an ordinal", () => {
  for (const mutate of [
    (h: ReturnType<typeof harness>) => h.append(h.track, h.element(8, "RN:CUIFocusView", "duplicate:thumb:0")),
    (h: ReturnType<typeof harness>) => {
      h.target.tagName = "RN:View"
    },
    (h: ReturnType<typeof harness>) => h.append(h.target, h.element(8, "RN:View")),
    (h: ReturnType<typeof harness>) => {
      h.paint.ownerDocument = {}
    },
    (h: ReturnType<typeof harness>) => {
      h.paint.isConnected = false
    },
  ]) {
    const h = harness()
    mutate(h)
    expect(() => acquireSliderLayoutOriginals(h.originalRoot)).toThrow(/Slider layout observer/)
    jest.restoreAllMocks()
  }
})

it("rejects cancellation, replaced original tags and layout changes before a delayed window receipt is admitted", async () => {
  for (const mutate of [
    (h: ReturnType<typeof harness>) => h.cancel(),
    (h: ReturnType<typeof harness>) => {
      h.target.id = "replaced:thumb:0"
    },
    (h: ReturnType<typeof harness>) => {
      h.tagByNode.set(h.target, 99)
    },
    (h: ReturnType<typeof harness>) => {
      const replacement = h.element(5, "RN:CUIFocusView", h.target.id)
      replacement.parentElement = h.track
      replacement.children = h.target.children
      replacement.children.forEach((child) => {
        ;(child as typeof h.target).parentElement = replacement
      })
      h.track.children[1] = replacement
    },
    (h: ReturnType<typeof harness>) =>
      h.paint.getBoundingClientRect.mockReturnValue({ x: 197, y: 70, width: 24, height: 24 }),
  ]) {
    const h = harness()
    let receive: Parameters<View["measureInWindow"]>[0] | undefined
    h.root.measureInWindow.mockImplementation((callback) => {
      receive = callback
    })
    const pending = readSliderLayoutOriginalGeometry(h.originalRoot, h.token)
    mutate(h)
    receive?.(20, 40, 300, 76)
    await expect(pending).rejects.toThrow(/cancelled|retired|changed/)
    expect(h.listeners.size).toBe(0)
    jest.restoreAllMocks()
  }
})

it("rejects a retired root, duplicate native tags and missing current form metadata instead of admitting a similar tree", () => {
  for (const mutate of [
    (h: ReturnType<typeof harness>) => {
      h.root.id = "another-root"
    },
    (h: ReturnType<typeof harness>) => {
      h.root.isConnected = false
    },
    (h: ReturnType<typeof harness>) => {
      h.tagByNode.set(h.paint, h.tagByNode.get(h.target)!)
    },
    (h: ReturnType<typeof harness>) => {
      h.metadata.tagName = "RN:View"
    },
  ]) {
    const h = harness()
    mutate(h)
    expect(() => acquireSliderLayoutOriginals(h.originalRoot)).toThrow(/Slider layout observer/)
    jest.restoreAllMocks()
  }
})

it("rejects missing actual bounds and inconsistent original-window frames without deriving geometry from authored styles", async () => {
  for (const mutate of [
    (h: ReturnType<typeof harness>) => {
      h.target.getBoundingClientRect.mockReturnValue({ x: NaN, y: 70, width: 24, height: 24 })
    },
    (h: ReturnType<typeof harness>) => {
      h.paint.getBoundingClientRect.mockReturnValue({ x: 196, y: 70, width: 0, height: 24 })
    },
    (h: ReturnType<typeof harness>) => {
      h.root.measureInWindow.mockImplementation((callback) => callback(20, 40, 301, 76))
    },
  ]) {
    const h = harness()
    mutate(h)
    await expect(readSliderLayoutOriginalGeometry(h.originalRoot, h.token)).rejects.toThrow(/bounds|frame changed/)
    expect(h.listeners.size).toBe(0)
    jest.restoreAllMocks()
  }
})

it("keeps pending native measurements cancellable under the enclosing attempt budget", async () => {
  jest.useFakeTimers()
  try {
    const h = harness()
    h.root.measureInWindow.mockImplementation(() => {})
    const pending = readSliderLayoutOriginalGeometry(h.originalRoot, h.token)
    const rejected = expect(pending).rejects.toThrow(/cancelled/)
    await jest.advanceTimersByTimeAsync(60000)
    expect(h.listeners.size).toBe(1)
    h.cancel()
    await rejected
    expect(h.listeners.size).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

it("accepts a delayed native callback only while the original nodes and geometry remain current", async () => {
  jest.useFakeTimers()
  try {
    const h = harness()
    let receive: Parameters<View["measureInWindow"]>[0] | undefined
    h.root.measureInWindow.mockImplementation((callback) => {
      receive = callback
    })
    const pending = readSliderLayoutOriginalGeometry(h.originalRoot, h.token)
    await jest.advanceTimersByTimeAsync(60000)
    expect(h.listeners.size).toBe(1)
    receive?.(20, 40, 300, 76)
    await expect(pending).resolves.toMatchObject({ tags: [1, 3, 5, 6] })
    expect(h.listeners.size).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})
