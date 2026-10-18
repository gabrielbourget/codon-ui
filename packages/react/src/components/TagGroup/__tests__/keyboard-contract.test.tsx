import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { I18nProvider } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import Tag from "../AdobeTag/AdobeTag"
import type { TTagGroupProps } from "../helpers"
import TagGroup from "../TagGroup"

type TModifiers = { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }
const fixture = async (props: Partial<TTagGroupProps<object>> = {}, link = false, locale = "en-US") => {
  const change = vi.fn(),
    owner = new Set(["a"])
  const content = (selectedKeys = props.selectedKeys ?? owner) => (
    <I18nProvider locale={locale}>
      <TagGroup
        aria-label="Tags"
        selectionMode="multiple"
        selectionBehavior="replace"
        onSelectionChange={change}
        disabledKeys={["disabled"]}
        {...props}
        selectedKeys={selectedKeys}
      >
        <Tag id="a" textValue="Alpha" data-testid="a">
          Alpha
        </Tag>
        <Tag id="disabled" textValue="Disabled" data-testid="disabled">
          Disabled
        </Tag>
        <Tag id="b" textValue="Beta" data-testid="b" href={link ? "https://example.test/beta" : undefined}>
          Beta
        </Tag>
        <Tag id="c" textValue="Charlie" data-testid="c" href={link ? "https://example.test/charlie" : undefined}>
          Charlie
        </Tag>
      </TagGroup>
    </I18nProvider>
  )
  const view = render(content())
  await act(async () => screen.getByTestId("a").focus())
  change.mockClear()
  return {
    change,
    owner,
    echo: (keys: NonNullable<TTagGroupProps<object>["selectedKeys"]>) => view.rerender(content(keys)),
  }
}
const send = (key: string, modifiers: TModifiers = {}) =>
  fireEvent.keyDown(document.activeElement!, { key, ...modifiers })

describe("native TagGroup keyboard contract oracle", () => {
  it.each([
    { key: "ArrowDown", target: "b" },
    { key: "ArrowUp", target: "c" },
    { key: "ArrowRight", target: "b" },
    { key: "ArrowLeft", target: "c" },
    { key: "Home", target: "a" },
    { key: "End", target: "c" },
  ])("$key focuses $target with disabled skipping and wrapping", async ({ key, target }) => {
    await fixture()
    send(key)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId(target)))
  })
  it.each([
    { behavior: "toggle" as const, modifiers: { shiftKey: true }, expected: ["a", "b"] },
    { behavior: "replace" as const, modifiers: { shiftKey: true }, expected: ["a", "b"] },
    { behavior: "replace" as const, modifiers: { ctrlKey: true }, expected: [] },
    { behavior: "replace" as const, modifiers: { altKey: true }, expected: ["b"] },
    { behavior: "toggle" as const, modifiers: {}, expected: [] },
  ])("ArrowDown preserves $behavior with $modifiers", async ({ behavior, modifiers, expected }) => {
    const { change, owner } = await fixture({ selectionBehavior: behavior })
    send("ArrowDown", modifiers)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("b")))
    expect(change.mock.calls.map(([keys]) => [...keys])).toEqual(expected.length ? [expected] : [])
    expect([...owner]).toEqual(["a"])
  })
  it.each([
    { modifiers: { shiftKey: true }, expected: ["c"] },
    { modifiers: { ctrlKey: true, shiftKey: true }, expected: ["a", "c"] },
    { modifiers: { ctrlKey: true }, expected: ["c"] },
  ])("End uses its distinct modifier contract: $modifiers", async ({ modifiers, expected }) => {
    const { change } = await fixture()
    send("End", modifiers)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("c")))
    expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([expected])
  })
  it("arrow focus does not select a link, while direct Home/End selection follows manager semantics", async () => {
    const { change } = await fixture({}, true)
    send("ArrowDown")
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("b")))
    expect(change).not.toHaveBeenCalled()
    send("Home")
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("a")))
    send("ArrowDown")
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("b")))
    expect(change).not.toHaveBeenCalled()
    send("End")
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("c")))
    expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([["c"]])
  })
  it("extends a real echoed selection anchor across enabled rows on Ctrl+Shift+Home", async () => {
    const { change, echo } = await fixture()
    send("End")
    const owner = change.mock.calls[0][0]
    echo(owner)
    change.mockClear()
    send("Home", { ctrlKey: true, shiftKey: true })
    expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([["a", "b", "c"]])
    expect([...owner]).toEqual(["c"])
    expect(owner.anchorKey).toBe("c")
  })
  it("Ctrl+A requests all repeatedly under veto and never toggles an already-all owner off", async () => {
    const { change, echo, owner } = await fixture()
    send("a", { ctrlKey: true })
    send("a", { ctrlKey: true })
    expect(change.mock.calls.map(([keys]) => keys)).toEqual(["all", "all"])
    expect([...owner]).toEqual(["a"])
    echo("all")
    change.mockClear()
    send("a", { ctrlKey: true })
    expect(change).not.toHaveBeenCalled()
  })
  it("Ctrl+A preserves an explicit complete owner set", async () => {
    const owner = new Set(["a", "b", "c"]),
      { change } = await fixture({ selectedKeys: owner })
    send("a", { ctrlKey: true })
    expect(change).not.toHaveBeenCalled()
    expect([...owner]).toEqual(["a", "b", "c"])
  })
  it("retains Delete repeats as owner removal requests", async () => {
    const remove = vi.fn()
    await fixture({ onRemove: remove })
    send("Delete")
    fireEvent.keyDown(document.activeElement!, { key: "Delete", repeat: true })
    expect(remove.mock.calls.map(([keys]) => [...keys])).toEqual([["a"], ["a"]])
  })
  it.each([
    { key: "ArrowRight", target: "c" },
    { key: "ArrowLeft", target: "b" },
  ])("RTL $key focuses $target", async ({ key, target }) => {
    await fixture({}, false, "ar-AE")
    send(key)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId(target)))
  })
  it("default delegate buffers text without search focus and captures a following Space before selection", async () => {
    const { change } = await fixture()
    send("b")
    expect(document.activeElement).toBe(screen.getByTestId("a"))
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    fireEvent(document.activeElement!, event)
    expect(event.defaultPrevented).toBe(true)
    expect(change).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByTestId("a"))
  })
})
