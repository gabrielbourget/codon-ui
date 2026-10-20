import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useContext, type ContextType } from "react"
import {
  CollectionRendererContext,
  DefaultCollectionRenderer,
  ListStateContext,
  SelectableCollectionContext,
} from "react-aria-components"
import { expect, it } from "vitest"

import Tag from "../../../../packages/react/src/components/TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../../packages/react/src/components/TagGroup/TagGroup"

it("matches TagGroup's deliberate physical-focus policy under a virtual-focus collection context", async () => {
  let state!: NonNullable<ContextType<typeof ListStateContext>>
  const trace: { kind: string; event: Event; target: EventTarget | null }[] = []
  const Root: typeof DefaultCollectionRenderer.CollectionRoot = (props) => {
    state = useContext(ListStateContext)!
    return <DefaultCollectionRenderer.CollectionRoot {...props} />
  }
  render(
    <>
      <input
        aria-label="Original editor"
        onBlur={(event) => trace.push({ kind: "editor-blur", event: event.nativeEvent, target: event.target })}
      />
      <SelectableCollectionContext.Provider value={{ shouldUseVirtualFocus: true }}>
        <CollectionRendererContext.Provider value={{ ...DefaultCollectionRenderer, CollectionRoot: Root }}>
          <TagGroup aria-label="Tags">
            <Tag
              id="a"
              textValue="Alpha"
              data-testid="virtual-row"
              onFocus={(event) => trace.push({ kind: "row-focus", event: event.nativeEvent, target: event.target })}
            >
              Alpha
            </Tag>
          </TagGroup>
        </CollectionRendererContext.Provider>
      </SelectableCollectionContext.Provider>
    </>,
  )
  const editor = screen.getByRole("textbox") as HTMLInputElement
  await userEvent.setup().type(editor, "held draft")
  const selection = [editor.selectionStart, editor.selectionEnd]
  await act(async () => {
    state.selectionManager.setFocused(true)
    state.selectionManager.setFocusedKey("a")
    await Promise.resolve()
  })
  expect(document.activeElement).toBe(screen.getByTestId("virtual-row"))
  expect(editor.value).toBe("held draft")
  expect([editor.selectionStart, editor.selectionEnd]).toEqual(selection)
  expect(trace.map((entry) => entry.kind)).toEqual(["editor-blur", "row-focus"])
  expect(trace.every((entry) => entry.event.isTrusted === true)).toBe(true)
  expect(trace[0].target).toBe(editor)
  expect(trace[1].target).toBe(screen.getByTestId("virtual-row"))
})
