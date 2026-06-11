import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Text from "../../Text/Text"
import Tag from "../AdobeTag/AdobeTag"
import type { TTagProps } from "../AdobeTag/helpers"
import {
  ORIENTATION__HORIZONTAL,
  ORIENTATION__VERTICAL,
  type TTagGroupOrientations,
  type TTagGroupProps,
} from "../helpers"
import TagGroup from "../TagGroup"
import styles from "../TagGroupStyles.module.css"

const baseTestItems = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
const testItems = baseTestItems.map((name, index) => ({ id: `${index + 1}`, name }))

const TagGroupExample = (
  props: Partial<TTagGroupProps<(typeof testItems)[number]>> & {
    height?: string | number
    width?: string | number
    orientation?: TTagGroupOrientations
    tagProps?: Partial<TTagProps>
  } = {},
) => {
  const {
    height,
    width,
    orientation = ORIENTATION__HORIZONTAL,
    customStyles,
    customClassName,
    customTagListClassName,
    customTagListStyles,
    tagProps,
    ...tagGroupProps
  } = props

  return (
    <TagGroup
      height={height}
      width={width}
      aria-label="tag-group"
      orientation={orientation}
      customClassName={customClassName}
      customStyles={customStyles}
      customTagListClassName={customTagListClassName}
      customTagListStyles={customTagListStyles}
      {...tagGroupProps}
    >
      {testItems.slice(0, 1).map(({ id, name }, index) => {
        return (
          <Tag aria-label={`Test tag ${index + 1}`} key={id} {...tagProps}>
            <Text>{name}</Text>
          </Tag>
        )
      })}
    </TagGroup>
  )
}

describe("<TagGroup />", () => {
  it("renders.", () => {
    render(<TagGroupExample />)

    expect(screen.getByTestId("tag-group")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<TagGroupExample height={30} width={400} />)
      const tagGroup = screen.getByTestId("tag-group")

      expect(tagGroup).toHaveStyle({ height: "30px", width: "400px" })
    })

    it("responds to orientation props.", () => {
      const { rerender } = render(<TagGroupExample orientation={ORIENTATION__HORIZONTAL} />)
      const tagList = screen.getByTestId("tag-list")

      expect(tagList).toHaveClass(styles["tagList--horizontal"])

      rerender(<TagGroupExample orientation={ORIENTATION__VERTICAL} />)
      expect(tagList).toHaveClass(styles["tagList--vertical"])
    })

    it("responds to custom styles prop.", () => {
      render(
        <TagGroupExample customStyles={{ height: 200, width: 500 }} customTagListStyles={{ backgroundColor: "red" }} />,
      )

      const tagGroup = screen.getByTestId("tag-group")
      const tagList = screen.getByTestId("tag-list")

      expect(tagGroup).toHaveStyle({ height: "200px", width: "500px" })
      expect(tagList).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    })

    it("merges native and custom root and tag-list styling props.", () => {
      render(
        <TagGroupExample
          className="native-tag-group"
          customClassName="custom-tag-group"
          customTagListClassName="custom-tag-list"
          customStyles={{ height: 200 }}
          customTagListStyles={{ backgroundColor: "red" }}
          style={{ width: 500 }}
        />,
      )

      const tagGroup = screen.getByTestId("tag-group")
      const tagList = screen.getByTestId("tag-list")

      expect(tagGroup).toHaveClass(styles.tagGroup)
      expect(tagGroup).toHaveClass("custom-tag-group")
      expect(tagGroup).toHaveClass("native-tag-group")
      expect(tagGroup).toHaveStyle({ height: "200px", width: "500px" })
      expect(tagList).toHaveClass("custom-tag-list")
      expect(tagList).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    })

    it("renders empty list messages through the tag list slot.", () => {
      render(
        <TagGroup items={[]} aria-label="empty tag group" emptyListMessage="No tags yet">
          {() => null}
        </TagGroup>,
      )

      expect(screen.getByText("No tags yet")).toBeInTheDocument()
    })

    it("consumes wrapper-only props before spreading root props.", () => {
      render(
        <TagGroupExample
          height={30}
          width={400}
          orientation={ORIENTATION__VERTICAL}
          emptyListMessage="No tags yet"
          customStyles={{ height: 200 }}
          customTagListStyles={{ backgroundColor: "red" }}
          customTagListClassName="custom-tag-list"
        />,
      )

      const tagGroup = screen.getByTestId("tag-group")

      expect(tagGroup).not.toHaveAttribute("height")
      expect(tagGroup).not.toHaveAttribute("width")
      expect(tagGroup).not.toHaveAttribute("orientation")
      expect(tagGroup).not.toHaveAttribute("emptyListMessage")
      expect(tagGroup).not.toHaveAttribute("customStyles")
      expect(tagGroup).not.toHaveAttribute("customTagListStyles")
      expect(tagGroup).not.toHaveAttribute("customTagListClassName")
    })
  })
})
