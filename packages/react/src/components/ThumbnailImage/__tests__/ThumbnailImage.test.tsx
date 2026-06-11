import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ThumbnailImage from "../ThumbnailImage"

describe("<ThumbnailImage /> Tests", () => {
  it("Renders the first resolved source candidate through the native renderer.", () => {
    render(
      <ThumbnailImage
        alt="Generic thumbnail"
        className="custom-thumbnail"
        data-testid="thumbnail-image"
        fallback={<span data-testid="thumbnail-image-fallback">Fallback</span>}
        height={80}
        srcCandidates={["/images/thumbnail.jpg", "/images/source.jpg"]}
        width={120}
      />,
    )

    const image = screen.getByTestId("thumbnail-image")

    expect(image).toHaveAttribute("alt", "Generic thumbnail")
    expect(image).toHaveAttribute("src", "/images/thumbnail.jpg")
    expect(image).toHaveClass("custom-thumbnail")
    expect(screen.queryByTestId("thumbnail-image-fallback")).not.toBeInTheDocument()
  })

  it("Renders fallback content when no source candidate is available.", () => {
    render(<ThumbnailImage fallback={<span data-testid="thumbnail-image-fallback">Fallback</span>} />)

    expect(screen.getByTestId("thumbnail-image-fallback")).toBeInTheDocument()
  })

  it("Advances through source candidates after image errors.", async () => {
    const onError = vi.fn()

    render(
      <ThumbnailImage
        alt="Fallback thumbnail"
        data-testid="thumbnail-image"
        fallback={<span data-testid="thumbnail-image-fallback">Fallback</span>}
        onError={onError}
        srcCandidates={["/images/thumbnail.jpg", "/images/source.jpg"]}
      />,
    )

    fireEvent.error(screen.getByTestId("thumbnail-image"))

    expect(onError).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByTestId("thumbnail-image")).toHaveAttribute("src", "/images/source.jpg")
    })

    fireEvent.error(screen.getByTestId("thumbnail-image"))

    await waitFor(() => {
      expect(screen.getByTestId("thumbnail-image-fallback")).toBeInTheDocument()
    })
    expect(onError).toHaveBeenCalledTimes(2)
  })

  it("Preserves source fallback progress across equivalent candidate rerenders.", async () => {
    const { rerender } = render(
      <ThumbnailImage
        alt="Rerendered thumbnail"
        data-testid="thumbnail-image"
        fallback={<span data-testid="thumbnail-image-fallback">Fallback</span>}
        srcCandidates={["/images/thumbnail.jpg", "/images/source.jpg"]}
      />,
    )

    fireEvent.error(screen.getByTestId("thumbnail-image"))

    await waitFor(() => {
      expect(screen.getByTestId("thumbnail-image")).toHaveAttribute("src", "/images/source.jpg")
    })

    rerender(
      <ThumbnailImage
        alt="Rerendered thumbnail"
        data-testid="thumbnail-image"
        fallback={<span data-testid="thumbnail-image-fallback">Fallback</span>}
        srcCandidates={["/images/thumbnail.jpg", "/images/source.jpg"]}
      />,
    )
    fireEvent.error(screen.getByTestId("thumbnail-image"))

    await waitFor(() => {
      expect(screen.getByTestId("thumbnail-image-fallback")).toBeInTheDocument()
    })
  })

  it("Can render through an injected image renderer.", () => {
    render(
      <ThumbnailImage
        alt="Injected thumbnail"
        fallback={<span data-testid="thumbnail-image-fallback">Fallback</span>}
        src="/images/source.jpg"
        renderImage={({ imageProps }) => <img {...imageProps} data-testid="injected-thumbnail-image" />}
      />,
    )

    expect(screen.getByTestId("injected-thumbnail-image")).toHaveAttribute("src", "/images/source.jpg")
  })
})
