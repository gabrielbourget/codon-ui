import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ThumbnailShowcase from "../ThumbnailShowcase"

const primaryPlaceholder = <div data-testid="primary-placeholder">Primary placeholder</div>
const renderSecondaryPlaceholder = ({ index }: { index: number }) => (
  <div data-testid="secondary-placeholder">Secondary placeholder {index + 1}</div>
)

describe("<ThumbnailShowcase /> Tests", () => {
  it("Renders only the primary placeholder when no media is available.", () => {
    render(
      <ThumbnailShowcase
        primaryPlaceholder={primaryPlaceholder}
        renderSecondaryPlaceholder={renderSecondaryPlaceholder}
      />,
    )

    expect(screen.getByTestId("primary-placeholder")).toBeInTheDocument()
    expect(screen.queryAllByTestId("secondary-placeholder")).toHaveLength(0)
  })

  it("Renders the secondary row and its remaining placeholders when media is available.", () => {
    render(
      <ThumbnailShowcase
        primaryContent={<div data-testid="primary-media">Primary media</div>}
        primaryPlaceholder={primaryPlaceholder}
        renderSecondaryPlaceholder={renderSecondaryPlaceholder}
        secondaryItems={[{ id: "secondary-1", content: <div data-testid="secondary-media">Secondary media</div> }]}
      />,
    )

    expect(screen.getByTestId("primary-media")).toBeInTheDocument()
    expect(screen.getByTestId("secondary-media")).toBeInTheDocument()
    expect(screen.getAllByTestId("secondary-placeholder")).toHaveLength(3)
  })

  it("Supports primary-only and secondary-only rendering modes.", () => {
    const { rerender } = render(
      <ThumbnailShowcase
        primaryContent={<div data-testid="primary-media">Primary media</div>}
        primaryPlaceholder={primaryPlaceholder}
        renderingMode="primary"
        secondaryItems={[{ id: "secondary-1", content: <div data-testid="secondary-media">Secondary media</div> }]}
      />,
    )

    expect(screen.getByTestId("primary-media")).toBeInTheDocument()
    expect(screen.queryByTestId("secondary-media")).not.toBeInTheDocument()

    rerender(
      <ThumbnailShowcase
        primaryContent={<div data-testid="primary-media">Primary media</div>}
        primaryPlaceholder={primaryPlaceholder}
        renderingMode="secondary"
        secondaryItems={[{ id: "secondary-1", content: <div data-testid="secondary-media">Secondary media</div> }]}
      />,
    )

    expect(screen.queryByTestId("primary-media")).not.toBeInTheDocument()
    expect(screen.getByTestId("secondary-media")).toBeInTheDocument()
  })

  it("Delegates overflow presentation while preserving the configured slot count.", () => {
    render(
      <ThumbnailShowcase
        primaryContent={<div>Primary media</div>}
        primaryPlaceholder={primaryPlaceholder}
        renderOverflow={({ hiddenItemCount }) => <div data-testid="overflow">+{hiddenItemCount}</div>}
        secondaryItems={Array.from({ length: 5 }).map((_, index) => ({
          id: `secondary-${index}`,
          content: <div data-testid="secondary-media">Secondary media {index + 1}</div>,
        }))}
      />,
    )

    expect(screen.getAllByTestId("secondary-media")).toHaveLength(3)
    expect(screen.getByTestId("overflow")).toHaveTextContent("+1")
  })

  it("Merges native root styling with the normalized width contract.", () => {
    render(
      <ThumbnailShowcase
        className="custom-showcase"
        data-testid="thumbnail-showcase"
        primaryPlaceholder={primaryPlaceholder}
        style={{ backgroundColor: "tomato" }}
        width={375}
      />,
    )

    expect(screen.getByTestId("thumbnail-showcase")).toHaveClass("custom-showcase")
    expect(screen.getByTestId("thumbnail-showcase")).toHaveStyle({
      "--thumbnail-showcase-width": "375px",
      backgroundColor: "rgb(255, 99, 71)",
    })
  })
})
