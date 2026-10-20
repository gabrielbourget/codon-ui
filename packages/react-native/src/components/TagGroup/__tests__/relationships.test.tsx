import { screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { NativeThemeProvider } from "../../.."
import { renderWithNativeCollections as render } from "../../../collection/__tests__/nativeReceipts"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"

beforeEach(() => {
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

it("binds ordered names and descriptions to the actual focusable list", async () => {
  const group = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <TagGroup
        ref={group}
        aria-labelledby="first-name second-name"
        aria-describedby={"first-description\nsecond-description"}
        aria-details="details"
        accessibilityHint="Original caller hint"
        labels={{ descriptionLabel: "Instructions", detailsLabel: "Details" }}
      >
        <Tag id="a">Alpha</Tag>
      </TagGroup>
    </NativeThemeProvider>,
  )
  expect(group.current).not.toBeNull()
  const list = screen.getByTestId("tag-list")
  expect(list.props).toMatchObject({
    nativeLabelledBy: ["first-name", "second-name"],
    nativeDescribedBy: ["first-description", "second-description"],
    nativeDetailsBy: ["details"],
    nativeDescriptionLabel: "Instructions",
    nativeDetailsLabel: "Details",
    accessibilityHint: "Original caller hint",
  })
})

it("retains explicit native name and empty relationship overrides", async () => {
  const names = ["native-name"]
  await render(
    <NativeThemeProvider>
      <TagGroup
        accessibilityLabel="Original label"
        accessibilityLabelledBy={names}
        aria-labelledby="ignored"
        ariaDescribedBy=""
        aria-describedby="ignored-description"
        ariaDetails={[]}
        aria-details="ignored-details"
        labels={{ descriptionLabel: "", detailsLabel: "" }}
      />
    </NativeThemeProvider>,
  )
  const list = screen.getByTestId("tag-list")
  expect(list.props).toMatchObject({
    accessibilityLabel: "Original label",
    nativeLabelledBy: names,
    nativeDescribedBy: [],
    nativeDetailsBy: [],
    nativeDescriptionLabel: "",
    nativeDetailsLabel: "",
  })
  expect(list.props.nativeLabelledBy).toBe(names)
})
