import { render, type RenderResult } from "@testing-library/react"
import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel"
import type { ReactElement } from "react"
import { vi } from "vitest"

import { CarouselContext, DEFAULT_CAROUSEL_LABELS, type TBaseCarouselItem, type TCarouselContext } from "../helpers"

type TEmblaEventName = "select" | "reInit"

type TEmblaMockConfig = {
  itemCount?: number
  selectedIndex?: number
  loop?: boolean
}

type TEmblaMockState = {
  itemCount: number
  selectedIndex: number
  loop: boolean
}

export type TEmblaApiMock = EmblaCarouselType & {
  __emit: (eventName: TEmblaEventName) => void
  __setLoop: (loop: boolean) => void
  __getSelectedIndex: () => number
}

type TCarouselTestItem = TBaseCarouselItem & {
  label: string
}

const DEFAULT_EMBLA_CONFIG: Required<TEmblaMockConfig> = {
  itemCount: 1,
  selectedIndex: 0,
  loop: true,
}

const clampIndex = (index: number, itemCount: number) => {
  if (itemCount <= 0) return 0
  return Math.min(Math.max(index, 0), itemCount - 1)
}

const wrapIndex = (index: number, itemCount: number) => {
  if (itemCount <= 0) return 0
  const normalizedIndex = index % itemCount
  return normalizedIndex < 0 ? normalizedIndex + itemCount : normalizedIndex
}

const createEmblaRefCallback = () =>
  vi.fn((node: HTMLDivElement | null) => {
    emblaViewportNode = node
  })

export const createEmblaApiMock = (config: TEmblaMockConfig = {}): TEmblaApiMock => {
  const listeners = {
    select: new Set<() => void>(),
    reInit: new Set<() => void>(),
  }

  const state: TEmblaMockState = {
    itemCount: config.itemCount ?? DEFAULT_EMBLA_CONFIG.itemCount,
    selectedIndex: clampIndex(config.selectedIndex ?? DEFAULT_EMBLA_CONFIG.selectedIndex, config.itemCount ?? 1),
    loop: config.loop ?? DEFAULT_EMBLA_CONFIG.loop,
  }

  const emit = (eventName: TEmblaEventName) => {
    listeners[eventName].forEach((listener) => listener())
  }

  const setSelectedIndex = (nextIndex: number) => {
    if (state.itemCount <= 1) {
      state.selectedIndex = 0
      emit("select")
      return
    }

    state.selectedIndex = state.loop ? wrapIndex(nextIndex, state.itemCount) : clampIndex(nextIndex, state.itemCount)
    emit("select")
  }

  const emblaApiMock = {
    canScrollNext: vi.fn(() => (state.loop ? state.itemCount > 1 : state.selectedIndex < state.itemCount - 1)),
    canScrollPrev: vi.fn(() => (state.loop ? state.itemCount > 1 : state.selectedIndex > 0)),
    off: vi.fn((eventName: TEmblaEventName, listener: () => void) => {
      listeners[eventName].delete(listener)
      return emblaApiMock
    }),
    on: vi.fn((eventName: TEmblaEventName, listener: () => void) => {
      listeners[eventName].add(listener)
      return emblaApiMock
    }),
    scrollNext: vi.fn(() => {
      setSelectedIndex(state.selectedIndex + 1)
    }),
    scrollPrev: vi.fn(() => {
      setSelectedIndex(state.selectedIndex - 1)
    }),
    scrollTo: vi.fn((index: number) => {
      setSelectedIndex(index)
    }),
    selectedScrollSnap: vi.fn(() => state.selectedIndex),
    __emit: emit,
    __getSelectedIndex: () => state.selectedIndex,
    __setLoop: (loop: boolean) => {
      state.loop = loop
    },
  } as unknown as TEmblaApiMock

  return emblaApiMock
}

let emblaOptions: EmblaOptionsType | undefined
let emblaViewportNode: HTMLDivElement | null = null
let emblaApiMock = createEmblaApiMock(DEFAULT_EMBLA_CONFIG)
let emblaRefCallback = createEmblaRefCallback()

export const resetEmblaMock = () => {
  emblaOptions = undefined
  emblaViewportNode = null
  emblaApiMock = createEmblaApiMock(DEFAULT_EMBLA_CONFIG)
  emblaRefCallback = createEmblaRefCallback()
}

export const configureEmblaMock = (config: TEmblaMockConfig = {}) => {
  emblaOptions = undefined
  emblaViewportNode = null
  emblaApiMock = createEmblaApiMock({
    ...DEFAULT_EMBLA_CONFIG,
    ...config,
  })
  emblaRefCallback = createEmblaRefCallback()
}

export const useEmblaCarouselMock = (options?: EmblaOptionsType) => {
  emblaOptions = options
  emblaApiMock.__setLoop(options?.loop ?? DEFAULT_EMBLA_CONFIG.loop)

  return [emblaRefCallback, emblaApiMock] as const
}

export const getEmblaApiMock = () => emblaApiMock

export const getEmblaOptions = (): EmblaOptionsType | undefined => emblaOptions

export const getEmblaViewportNode = () => emblaViewportNode

export const createCarouselItems = (count: number): TCarouselTestItem[] =>
  Array.from({ length: count }, (_, index) => ({
    ID: `carousel-item-${index + 1}`,
    label: `Carousel Item ${index + 1}`,
  }))

export const createCarouselContextValue = (overrides: Partial<TCarouselContext> = {}): TCarouselContext => ({
  emblaApi: null,
  selectedIndex: 0,
  itemCount: 5,
  canScrollPrev: true,
  canScrollNext: true,
  scrollPrev: vi.fn(),
  scrollNext: vi.fn(),
  scrollTo: vi.fn(),
  getItemIDForIndex: (index: number) => `carousel-item-index-${index + 1}`,
  labels: DEFAULT_CAROUSEL_LABELS,
  ...overrides,
})

export const renderWithCarouselContext = (
  element: ReactElement,
  overrides: Partial<TCarouselContext> = {},
): RenderResult =>
  render(<CarouselContext.Provider value={createCarouselContextValue(overrides)}>{element}</CarouselContext.Provider>)

export const renderCarouselWithEmbla = (element: ReactElement, config: TEmblaMockConfig = {}): RenderResult => {
  configureEmblaMock(config)
  return render(element)
}
