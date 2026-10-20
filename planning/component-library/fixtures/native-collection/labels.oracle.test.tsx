import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createContext, useContext, type ComponentProps } from "react"
import { Button, CollectionRendererContext, DefaultCollectionRenderer, Label, Text } from "react-aria-components"
import { expect, it } from "vitest"

import {
  nativeCompositeLabelProps,
  nativeAccessibilityIDs,
} from "../../../../packages/react-native/src/input/accessibilityReferences"
import Tag from "../../../../packages/react/src/components/TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../../packages/react/src/components/TagGroup/TagGroup"

const FieldVisibility = createContext(true)
const FieldRoot: typeof DefaultCollectionRenderer.CollectionRoot = (props) => {
  const visible = useContext(FieldVisibility)
  const independentProps: ComponentProps<typeof Text> = {
    // @ts-expect-error The pinned Text runtime accepts null slots, while its DOM declaration accepts only strings.
    slot: null,
    id: "independent",
  }
  const independent = <Text {...independentProps}>Independent</Text>
  return (
    <>
      {visible && (
        <>
          <Label id="visible-label">Tags</Label>
          <Text slot="description" data-testid="field-description">
            Instructions
          </Text>
          <Text slot="errorMessage" data-testid="field-error">
            Problem
          </Text>
        </>
      )}
      {independent}
      <DefaultCollectionRenderer.CollectionRoot {...props} />
    </>
  )
}
it("retains actual field-slot naming and descriptions through visible slot retirement", () => {
  const example = (visible: boolean) => (
    <FieldVisibility.Provider value={visible}>
      <CollectionRendererContext.Provider value={{ ...DefaultCollectionRenderer, CollectionRoot: FieldRoot }}>
        <span id="external-name">External</span>
        <span id="external-description">Extra instructions</span>
        <TagGroup aria-label="Own" aria-labelledby="external-name" aria-describedby="external-description">
          <Tag id="a">Alpha</Tag>
        </TagGroup>
      </CollectionRendererContext.Provider>
    </FieldVisibility.Provider>
  )
  const view = render(example(true))
  const field = screen.getByRole("grid")
  expect(field).toHaveAccessibleName("Own Tags External")
  expect(field).toHaveAccessibleDescription("Instructions Problem Extra instructions")
  view.rerender(example(false))
  expect(field).toHaveAccessibleName("Own External")
  expect(field).toHaveAccessibleDescription("Extra instructions")
  view.rerender(example(true))
  expect(field).toHaveAccessibleName("Own Tags External")
  expect(field).toHaveAccessibleDescription("Instructions Problem Extra instructions")
})

it.each(["remove", null] as const)("retains the actual grouped Button context for slot %s", async (slot) => {
  const calls: unknown[] = []
  render(
    <TagGroup aria-label="Tags" onRemove={(keys) => calls.push([...keys])}>
      <Tag id="a" textValue="Alpha">
        <Button slot={slot} data-testid="authored-remove" onPress={() => calls.push("caller")}>
          Authored
        </Button>
      </Tag>
    </TagGroup>,
  )
  const button = screen.getByTestId("authored-remove")
  expect(button).toHaveAccessibleName(slot === "remove" ? "Remove Alpha" : "Authored")
  await userEvent.setup().click(button)
  expect(calls).toEqual(slot === "remove" ? [["a"], "caller"] : ["caller"])
})

it("uses selected owner membership when Backspace originates on an authored remove button", async () => {
  const requests: unknown[] = []
  render(
    <TagGroup
      aria-label="Tags"
      selectionMode="multiple"
      selectedKeys={["a", "b"]}
      onRemove={(keys) => requests.push([...keys])}
    >
      <Tag id="a" textValue="Alpha">
        <Button slot="remove" data-testid="authored-key-remove">
          Custom removal
        </Button>
      </Tag>
      <Tag id="b">Beta</Tag>
    </TagGroup>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByTestId("authored-key-remove"))
  await user.keyboard("{Backspace}")
  expect(requests).toEqual([["a"], ["a", "b"]])
})

it.each([
  { label: "Own", references: "reference" },
  { label: "0", references: " reference  reference " },
  { label: "", references: "reference" },
  { label: "Own", references: undefined },
])("matches the actual TagGroup field-label attributes for $label/$references", ({ label, references }) => {
  render(
    <>
      <span id="reference">Referenced</span>
      <TagGroup id="wrapper" aria-label={label} aria-labelledby={references}>
        <Tag id="a">Alpha</Tag>
      </TagGroup>
    </>,
  )
  const field = screen.getByRole("grid")
  const id = field.getAttribute("id")!
  expect(id).toBeTruthy()
  expect(id).not.toBe("wrapper")
  const native = nativeCompositeLabelProps(
    { accessibilityLabel: label, nativeLabelledBy: nativeAccessibilityIDs(references) },
    id,
  )
  expect(native.nativeID).toBe(id)
  expect(native.nativeLabelledBy ?? []).toEqual(
    nativeAccessibilityIDs(field.getAttribute("aria-labelledby") ?? undefined) ?? [],
  )
})
