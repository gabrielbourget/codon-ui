import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("embla-carousel-react", async () => {
  const element = await import("./emblaTestHarness")
  return {
    default: element.useEmblaCarouselMock,
  }
})

import Carousel from "../Carousel"
import styles from "../CarouselStyles.module.css"
import {
  CAROUSEL_ALIGNMENT_AXIS__Y,
  CAROUSEL_CHROME_OVERLAY_STRATEGY__NONE,
  CAROUSEL_KEYBOARD_NAV_TARGET__ROOT,
  CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT,
  type TBaseCarouselItem,
  type TCarouselProps,
} from "../helpers"

import { createCarouselItems, getEmblaApiMock, renderCarouselWithEmbla, resetEmblaMock } from "./emblaTestHarness"

type TCarouselTestItem = TBaseCarouselItem & {
  label: string
}

const renderCarousel = ({
  items = createCarouselItems(3),
  ...props
}: Partial<TCarouselProps<TCarouselTestItem>> & {
  items?: TCarouselTestItem[]
} = {}) =>
  renderCarouselWithEmbla(
    <Carousel
      items={items}
      renderCarouselItem={({ item, index, isSelected }) => (
        <div>
          <span>{item.label}</span>
          <span>{`index-${index}`}</span>
          <span>{String(isSelected)}</span>
        </div>
      )}
      {...props}
    />,
    {
      itemCount: items.length,
      selectedIndex: 0,
      loop: props.loopEnabled ?? true,
    },
  )

const getViewport = (container: HTMLElement) =>
  container.querySelector(`.${styles.carousel__viewport}`) as HTMLDivElement

const getChromeOverlay = (container: HTMLElement) => container.querySelector(`.${styles.carousel__chrome}`)

describe("<Carousel /> Tests", () => {
  beforeEach(() => {
    resetEmblaMock()
  })

  it("Renders carousel semantics and slide metadata correctly.", () => {
    renderCarousel()

    const region = screen.getByRole("region", { name: "Content Carousel" })
    const slides = screen.getAllByRole("group")

    expect(region).toHaveAttribute("aria-roledescription", "carousel")
    expect(screen.getByText("Item 1 of 3")).toBeInTheDocument()
    expect(slides).toHaveLength(3)
    expect(slides[0]).toHaveAttribute("aria-roledescription", "slide")
    expect(slides[0]).toHaveAttribute("aria-label", "Item 1 of 3")
    expect(slides[0]).toHaveAttribute("aria-current", "true")
    expect(slides[1]).not.toHaveAttribute("aria-current")
  })

  it("Applies grouped labels to the root, live region, and slide metadata.", () => {
    renderCarousel({
      labels: {
        root: {
          ariaLabel: "Localized carousel",
          ariaRoleDescription: "localized carousel",
          liveRegionText: ({ itemNumber, itemCount }) => `Viewing localized item ${itemNumber} of ${itemCount}`,
        },
        item: {
          ariaRoleDescription: "localized slide",
          ariaLabel: ({ itemNumber, itemCount }) => `Localized slide ${itemNumber} of ${itemCount}`,
        },
      },
    })

    const region = screen.getByRole("region", { name: "Localized carousel" })
    const slides = screen.getAllByRole("group")

    expect(region).toHaveAttribute("aria-roledescription", "localized carousel")
    expect(screen.getByText("Viewing localized item 1 of 3")).toBeInTheDocument()
    expect(slides[0]).toHaveAttribute("aria-roledescription", "localized slide")
    expect(slides[0]).toHaveAttribute("aria-label", "Localized slide 1 of 3")
  })

  it("Clamps the initial index and notifies index changes.", async () => {
    const onIndexChange = vi.fn()

    renderCarousel({
      initialIndex: 99,
      onIndexChange,
    })

    await waitFor(() => {
      expect(onIndexChange).toHaveBeenCalledWith(2)
    })

    expect(vi.mocked(getEmblaApiMock().scrollTo).mock.calls[0]).toEqual([2, true])

    act(() => {
      getEmblaApiMock().scrollTo(1)
    })

    await waitFor(() => {
      expect(onIndexChange).toHaveBeenLastCalledWith(1)
    })
  })

  it("Honors custom item ids and reports the viewport ref.", () => {
    const onViewportRefChange = vi.fn()

    const { container } = renderCarousel({
      getItemID: (index) => `custom-item-id-${index}`,
      onViewportRefChange,
    })

    const slides = screen.getAllByRole("group")

    expect(slides[0]).toHaveAttribute("id", "custom-item-id-0")
    expect(slides[1]).toHaveAttribute("id", "custom-item-id-1")
    expect(onViewportRefChange).toHaveBeenCalledWith(getViewport(container))
  })

  it("Attaches keyboard navigation to the viewport by default.", () => {
    const { container } = renderCarousel({
      loopEnabled: false,
      initialIndex: 1,
      keyboardNavigationTarget: CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT,
    })

    const api = getEmblaApiMock()
    vi.mocked(api.scrollPrev).mockClear()

    fireEvent.keyDown(getViewport(container), { key: "ArrowLeft" })

    expect(api.scrollPrev).toHaveBeenCalledTimes(1)
  })

  it("Attaches keyboard navigation to the root when requested.", () => {
    renderCarousel({
      loopEnabled: false,
      initialIndex: 1,
      keyboardNavigationTarget: CAROUSEL_KEYBOARD_NAV_TARGET__ROOT,
    })

    const api = getEmblaApiMock()
    vi.mocked(api.scrollNext).mockClear()

    fireEvent.keyDown(screen.getByRole("region", { name: "Content Carousel" }), { key: "ArrowRight" })

    expect(api.scrollNext).toHaveBeenCalledTimes(1)
  })

  it("Supports vertical arrow navigation and home/end keys.", () => {
    const { container } = renderCarousel({
      loopEnabled: false,
      initialIndex: 1,
      axis: CAROUSEL_ALIGNMENT_AXIS__Y,
    })

    const api = getEmblaApiMock()
    vi.mocked(api.scrollPrev).mockClear()
    vi.mocked(api.scrollNext).mockClear()
    vi.mocked(api.scrollTo).mockClear()

    fireEvent.keyDown(getViewport(container), { key: "ArrowUp" })
    fireEvent.keyDown(getViewport(container), { key: "ArrowDown" })
    fireEvent.keyDown(getViewport(container), { key: "Home" })
    fireEvent.keyDown(getViewport(container), { key: "End" })

    expect(api.scrollPrev).toHaveBeenCalledTimes(1)
    expect(api.scrollNext).toHaveBeenCalledTimes(1)
    expect(api.scrollTo).toHaveBeenNthCalledWith(1, 0)
    expect(api.scrollTo).toHaveBeenNthCalledWith(2, 2)
  })

  it("Ignores keyboard navigation when disabled, when modifiers are used, and when the target is editable.", () => {
    const disabledView = renderCarousel({
      loopEnabled: false,
      initialIndex: 1,
      enableKeyboardNavigation: false,
      renderCarouselItem: () => <input aria-label="Inline input" />,
    })

    const api = getEmblaApiMock()
    vi.mocked(api.scrollNext).mockClear()

    fireEvent.keyDown(getViewport(disabledView.container), { key: "ArrowRight" })

    expect(api.scrollNext).not.toHaveBeenCalled()

    disabledView.unmount()

    const enabledView = renderCarousel({
      loopEnabled: false,
      initialIndex: 1,
      enableKeyboardNavigation: true,
      renderCarouselItem: () => <input aria-label="Inline input" />,
    })

    vi.mocked(api.scrollNext).mockClear()

    fireEvent.keyDown(screen.getAllByRole("textbox", { name: "Inline input" })[0], { key: "ArrowRight" })
    fireEvent.keyDown(getViewport(enabledView.container), { key: "ArrowRight", metaKey: true })

    expect(api.scrollNext).not.toHaveBeenCalled()
  })

  it("Renders chrome as an overlay by default and directly when overlay is disabled.", () => {
    const { container, rerender } = renderCarousel({
      chromeSlot: <div data-testid="chrome-content">Chrome</div>,
    })

    expect(getChromeOverlay(container)).toBeInTheDocument()
    expect(screen.getByTestId("chrome-content")).toBeInTheDocument()

    rerender(
      <Carousel
        items={createCarouselItems(3)}
        chromeSlot={<div data-testid="chrome-content">Chrome</div>}
        chromeOverlayStrategy={CAROUSEL_CHROME_OVERLAY_STRATEGY__NONE}
        renderCarouselItem={({ item }) => <div>{item.label}</div>}
      />,
    )

    expect(getChromeOverlay(container)).not.toBeInTheDocument()
    expect(screen.getByTestId("chrome-content")).toBeInTheDocument()
  })

  it("Invokes the chrome slot callback with the current context and custom slot marker.", () => {
    const chromeSlot = vi.fn(({ context, slot }) => (
      <div data-testid="chrome-context">{`${slot}-${context.itemCount}-${context.selectedIndex}`}</div>
    ))

    renderCarousel({
      items: createCarouselItems(4),
      chromeSlot,
    })

    expect(chromeSlot).toHaveBeenCalled()
    expect(chromeSlot.mock.calls[0][0].slot).toBe("custom")
    expect(chromeSlot.mock.calls[0][0].context.itemCount).toBe(4)
    expect(screen.getByTestId("chrome-context")).toHaveTextContent("custom-4-0")
  })

  it("Merges root and slot style props.", () => {
    const { container } = renderCarousel({
      chromeSlot: <div>Chrome</div>,
      className: "native-root-class",
      customClassName: "root-class",
      customStyles: { color: "turquoise" },
      style: { backgroundColor: "blue" },
      customViewportClassName: "viewport-class",
      customViewportStyles: { backgroundColor: "red" },
      customContainerClassName: "container-class",
      customContainerStyles: { opacity: 0.8 },
      customItemClassName: "item-class",
      customItemStyles: { padding: 5 },
      customChromeClassName: "chrome-class",
      customChromeStyles: { transform: "translateY(5px)" },
      ariaLabel: "Gallery carousel",
    })

    const region = screen.getByRole("region", { name: "Gallery carousel" })
    const firstSlide = screen.getAllByRole("group")[0]

    expect(region).toHaveClass("native-root-class")
    expect(region).toHaveClass("root-class")
    expect(region).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(region).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    expect(getViewport(container)).toHaveClass("viewport-class")
    expect(getViewport(container)).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    expect(container.querySelector(`.${styles.carousel__container}`)).toHaveClass("container-class")
    expect(container.querySelector(`.${styles.carousel__container}`)).toHaveStyle({ opacity: "0.8" })
    expect(firstSlide).toHaveClass("item-class")
    expect(firstSlide).toHaveStyle({ padding: "5px" })
    expect(getChromeOverlay(container)).toHaveClass("chrome-class")
    expect(getChromeOverlay(container)).toHaveStyle({ transform: "translateY(5px)" })
  })
})
