import { readFileSync } from "node:fs"

import { fireEvent, render, screen } from "@testing-library/react"
import type { CSSProperties } from "react"
import { describe, expect, it, vi } from "vitest"

import Text from "../../../Text/Text"
import type { TTagGroupOrientations } from "../../helpers"
import { ORIENTATION__HORIZONTAL } from "../../helpers"
import TagGroup from "../../TagGroup"
import Tag from "../AdobeTag"
import styles from "../AdobeTagStyles.module.css"
import type { TTagProps } from "../helpers"

const tagStylesSource = readFileSync("src/components/TagGroup/AdobeTag/AdobeTagStyles.module.css", "utf8")

const baseTestItems = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
const testItems = baseTestItems.map((name, index) => ({ id: `${index + 1}`, name }))

const TagGroupExample = (props: {
  orientation?: TTagGroupOrientations
  customStyles?: CSSProperties
  customTagListStyles?: CSSProperties
  tagProps?: Partial<TTagProps>
}) => {
  const { orientation = ORIENTATION__HORIZONTAL, customStyles, customTagListStyles, tagProps } = props

  return (
    <TagGroup
      aria-label="tag-group"
      orientation={orientation}
      customStyles={customStyles}
      customTagListStyles={customTagListStyles}
    >
      {testItems.map(({ id, name }, index) => {
        return (
          <Tag aria-label={`Test tag ${index + 1}`} key={id} {...tagProps}>
            <Text>{name}</Text>
          </Tag>
        )
      })}
    </TagGroup>
  )
}

const RemovableTagGroupExample = (props: { tagProps?: Partial<TTagProps> }) => {
  const { tagProps } = props

  return (
    <TagGroup aria-label="removable tag-group" onRemove={vi.fn()}>
      <Tag aria-label="Removable tag" textValue="Option 1" {...tagProps}>
        <Text>Option 1</Text>
      </Tag>
    </TagGroup>
  )
}

describe("<AdobeTag />", () => {
  it("renders.", () => {
    render(<TagGroupExample />)
    const tags = screen.getAllByTestId("tag")

    tags.forEach((tag, i) => {
      expect(tag).toBeInTheDocument()
      expect(tag).toHaveTextContent(`Option ${i + 1}`)
    })
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<TagGroupExample tagProps={{ height: 30, width: 100 }} />)
      const tags = screen.getAllByTestId("tag")

      tags.forEach((tag) => expect(tag).toHaveStyle({ height: "30px", width: "100px" }))
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<TagGroupExample tagProps={{ geometry: "rounded" }} />)
      let tags = screen.getAllByTestId("tag")

      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--rounded"]))

      rerender(<TagGroupExample tagProps={{ geometry: "round" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--round"]))

      rerender(<TagGroupExample tagProps={{ geometry: "orthogonal" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => {
        expect(tag).not.toHaveClass(styles["tag--rounded"])
        expect(tag).not.toHaveClass(styles["tag--round"])
      })
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<TagGroupExample />)
      let tags = screen.getAllByTestId("tag")

      tags.forEach((tag) => {
        expect(tag).toHaveClass(styles["tag--default"])
        expect(tag).not.toHaveClass(styles["tag--primary"])
      })

      rerender(<TagGroupExample tagProps={{ order: "primary" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--primary"]))

      rerender(<TagGroupExample tagProps={{ order: "secondary" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--secondary"]))

      rerender(<TagGroupExample tagProps={{ order: "tertiary" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--tertiary"]))

      rerender(<TagGroupExample tagProps={{ order: "quaternary" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--quaternary"]))

      rerender(<TagGroupExample tagProps={{ order: "quintenary" }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--quintenary"]))
    })

    it("selected order styles consume semantic action foreground/background pairs.", () => {
      expect(tagStylesSource).toContain(
        ".tag--primary[data-selected] {\n  background-color: var(--cui-tag-primary-selected-background);\n  border: 1px solid var(--cui-tag-primary-selected-border)",
      )
      expect(tagStylesSource).toContain(
        ".tag--quintenary[data-selected] {\n  background-color: var(--cui-tag-quintenary-selected-background);\n  border: 1px solid var(--cui-tag-quintenary-selected-border)",
      )
      expect(tagStylesSource).toContain("color: var(--cui-tag-quintenary-selected-foreground)")
      expect(tagStylesSource).not.toContain("color: var(--white)")
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<TagGroupExample />)
      let tag = screen.getAllByTestId("tag")[0]

      fireEvent.focus(tag)

      tag = screen.getAllByTestId("tag")[0]
      expect(tag).toHaveClass(styles["tag--applyFocusStyle"])
      expect(tag).toHaveClass(styles["tag--offsetFocusRing"])

      rerender(<TagGroupExample tagProps={{ enableFocusStyle: false, offsetFocusRing: false }} />)
      tag = screen.getAllByTestId("tag")[0]

      fireEvent.blur(tag)

      tag = screen.getAllByTestId("tag")[0]
      expect(tag).not.toHaveClass(styles["tag--applyFocusStyle"])
      expect(tag).not.toHaveClass(styles["tag--offsetFocusRing"])
    })

    it("responds to color prop.", () => {
      const { rerender } = render(<TagGroupExample tagProps={{ color: "red" }} />)
      let tags = screen.getAllByTestId("tag")

      tags.forEach((tag) => expect(tag).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" }))

      rerender(<TagGroupExample tagProps={{ transparent: true }} />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--transparent"]))
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<TagGroupExample tagProps={{ raised: true }} />)
      let tags = screen.getAllByTestId("tag")

      tags.forEach((tag) => expect(tag).toHaveClass(styles["tag--raised"]))

      rerender(<TagGroupExample />)
      tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => expect(tag).not.toHaveClass(styles["tag--raised"]))
    })

    it("responds to custom styles prop.", () => {
      render(<TagGroupExample tagProps={{ customStyles: { color: "magenta", borderRadius: 5 } }} />)
      const tags = screen.getAllByTestId("tag")

      tags.forEach((tag) => expect(tag).toHaveStyle({ color: "rgb(255, 0, 255)", borderRadius: "5px" }))
    })

    it("merges native and custom root styling props without losing computed classes.", () => {
      render(
        <TagGroupExample
          tagProps={{
            color: "red",
            className: "native-tag-class",
            customClassName: "custom-tag-class",
            customStyles: { marginTop: 5 },
            style: { backgroundColor: "tomato", marginBottom: 10 },
          }}
        />,
      )

      const tags = screen.getAllByTestId("tag")
      tags.forEach((tag) => {
        expect(tag).toHaveClass(styles.tag)
        expect(tag).toHaveClass("custom-tag-class")
        expect(tag).toHaveClass("native-tag-class")
        expect(tag).toHaveStyle({
          backgroundColor: "rgb(255, 99, 71)",
          marginTop: "5px",
          marginBottom: "10px",
        })
      })
    })

    it("consumes wrapper-only props before spreading root props.", () => {
      render(
        <TagGroupExample
          tagProps={{
            closeIcon: <span data-testid="custom-close-icon">Close</span>,
            color: "red",
            customClassName: "custom-tag-class",
            customStyles: { color: "magenta" },
            enableFocusStyle: false,
            geometry: "round",
            height: 30,
            offsetFocusRing: false,
            order: "secondary",
            raised: true,
            transparent: true,
            width: 100,
          }}
        />,
      )

      const tag = screen.getAllByTestId("tag")[0]

      expect(tag).not.toHaveAttribute("closeIcon")
      expect(tag).not.toHaveAttribute("color")
      expect(tag).not.toHaveAttribute("customClassName")
      expect(tag).not.toHaveAttribute("customStyles")
      expect(tag).not.toHaveAttribute("enableFocusStyle")
      expect(tag).not.toHaveAttribute("geometry")
      expect(tag).not.toHaveAttribute("height")
      expect(tag).not.toHaveAttribute("offsetFocusRing")
      expect(tag).not.toHaveAttribute("order")
      expect(tag).not.toHaveAttribute("raised")
      expect(tag).not.toHaveAttribute("transparent")
      expect(tag).not.toHaveAttribute("width")
    })

    it("supports React Aria render-prop children.", () => {
      render(
        <TagGroup aria-label="render-prop tag-group">
          <Tag aria-label="Render prop tag" textValue="Option 1">
            {({ isSelected }) => <Text>{isSelected ? "Selected" : "Not selected"}</Text>}
          </Tag>
        </TagGroup>,
      )

      expect(screen.getByText("Not selected")).toBeInTheDocument()
    })

    it("renders the local default close icon when removal is enabled.", () => {
      render(<RemovableTagGroupExample />)

      expect(screen.getByTestId("tag-default-close-icon")).toBeInTheDocument()
    })

    it("preserves the custom closeIcon override when removal is enabled.", () => {
      render(<RemovableTagGroupExample tagProps={{ closeIcon: <span data-testid="custom-close-icon">Close</span> }} />)

      expect(screen.getByTestId("custom-close-icon")).toBeInTheDocument()
      expect(screen.queryByTestId("tag-default-close-icon")).not.toBeInTheDocument()
    })
  })
})
