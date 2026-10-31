import "../../../collection/__tests__/nativeReceipts"

import { createContext, createRef, useContext } from "react"
import * as RN from "react-native"

import { NativeThemeProvider } from "../../.."
import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import { NativeTagGroupLabelContext, NativeTagGroupTextContext, TagGroupLabel, TagGroupText } from "../field"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"

const Visibility = createContext(true)
const labelRef = createRef<RN.Text>()
const Root = (props: TNativeCollectionRootProps) => {
  const visible = useContext(Visibility)
  return (
    <>
      {visible && (
        <>
          <TagGroupLabel ref={labelRef} id="visible-label" testID="field-label">
            Tags
          </TagGroupLabel>
          <TagGroupText slot="description" testID="field-description">
            Instructions
          </TagGroupText>
          <TagGroupText slot="errorMessage" testID="field-error">
            Problem
          </TagGroupText>
        </>
      )}
      <TagGroupText slot={null} nativeID="independent">
        Independent
      </TagGroupText>
      <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
    </>
  )
}
const example = (visible: boolean) => (
  <NativeThemeProvider>
    <Visibility.Provider value={visible}>
      <NativeCollectionRendererContext.Provider value={{ ...DefaultNativeCollectionRenderer, CollectionRoot: Root }}>
        <TagGroup accessibilityLabel="Own" aria-labelledby="external-name" aria-describedby="external-description">
          <Tag id="a">Alpha</Tag>
        </TagGroup>
      </NativeCollectionRendererContext.Provider>
    </Visibility.Provider>
  </NativeThemeProvider>
)

beforeEach(() => jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

it("binds mounted label, description and error slots to the actual field and retires missing slots", async () => {
  const view = await render(example(true))
  const field = () => screen.getByTestId("tag-list")
  expect(labelRef.current).not.toBeNull()
  expect(field().props.nativeLabelledBy).toEqual([field().props.nativeID, "visible-label", "external-name"])
  const description = screen.getByTestId("field-description").props.nativeID
  const error = screen.getByTestId("field-error").props.nativeID
  expect(description).toBeTruthy()
  expect(error).toBeTruthy()
  expect(field().props.nativeDescribedBy).toEqual([description, error, "external-description"])
  expect(field().props.nativeDescribedBy).not.toContain("independent")
  await view.rerender(example(false))
  expect(labelRef.current).toBeNull()
  expect(field().props.nativeLabelledBy).toEqual([field().props.nativeID, "external-name"])
  expect(field().props.nativeDescribedBy).toEqual(["external-description"])
  await view.rerender(example(true))
  expect(field().props.nativeDescribedBy).toEqual([description, error, "external-description"])
})

it("retains slotted caller precedence and actual inherited text refs", async () => {
  const inherited = createRef<RN.Text>(),
    caller = createRef<RN.Text>()
  await render(
    <NativeThemeProvider>
      <NativeTagGroupLabelContext.Provider
        value={{ nativeID: "inherited", ref: inherited, accessibilityLabel: "Inherited" }}
      >
        <TagGroupLabel ref={caller} nativeID="caller" accessibilityLabel="Caller" testID="label">
          Name
        </TagGroupLabel>
      </NativeTagGroupLabelContext.Provider>
      <NativeTagGroupTextContext.Provider value={{ slots: { description: { nativeID: "description" } } }}>
        <TagGroupText slot="description" testID="description">
          Description
        </TagGroupText>
        <TagGroupText slot={null} testID="null">
          Independent
        </TagGroupText>
      </NativeTagGroupTextContext.Provider>
    </NativeThemeProvider>,
  )
  expect(caller.current).toBe(inherited.current)
  expect(caller.current).not.toBeNull()
  expect(screen.getByTestId("label").props.nativeID).toBe("caller")
  expect(screen.getByTestId("label").props.accessibilityLabel).toBe("Caller")
  expect(screen.getByTestId("description").props.nativeID).toBe("description")
  expect(screen.getByTestId("null").props.nativeID).toBeUndefined()
})
