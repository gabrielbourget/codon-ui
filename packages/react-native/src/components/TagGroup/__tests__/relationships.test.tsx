import { screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { NativeThemeProvider } from "../../.."
import { renderWithNativeCollections as render } from "../../../collection/__tests__/nativeReceipts"
import { NativeSelectableCollectionContext } from "../../../collection/context"
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

it("composes the owning name without mutating native references or empty overrides", async () => {
  const names = ["native-name"]
  Object.freeze(names)
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
    nativeLabelledBy: [list.props.nativeID, ...names],
    nativeDescribedBy: [],
    nativeDetailsBy: [],
    nativeDescriptionLabel: "",
    nativeDetailsLabel: "",
  })
  expect(list.props.nativeID).toBeTruthy()
  expect(names).toEqual(["native-name"])
})

it("keeps the outer group identity separate from the context-owned labelled field", async () => {
  const listRef = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <NativeSelectableCollectionContext.Provider value={{ id: "field", ref: listRef }}>
        <TagGroup id="wrapper" accessibilityLabel="Own" aria-labelledby="reference" />
      </NativeSelectableCollectionContext.Provider>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("tag-group").props.nativeID).toBe("wrapper")
  const list = screen.getByTestId("tag-list")
  expect(list.props.nativeID).toBe("field")
  expect(list.props.nativeLabelledBy).toEqual(["field", "reference"])
  expect(listRef.current).not.toBeNull()
})
