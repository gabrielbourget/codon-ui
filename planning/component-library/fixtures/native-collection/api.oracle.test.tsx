import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ComponentProps, FocusEvent } from "react"
import { expect, it } from "vitest"

import Tag from "../../../../packages/react/src/components/TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../../packages/react/src/components/TagGroup/TagGroup"

it.each(["all", "selection"] as const)("characterizes source disabledBehavior=%s", async (disabledBehavior) => {
  const trace: string[] = []
  const runtimeProps: ComponentProps<typeof TagGroup> = {
    // @ts-expect-error The pinned public TagGroup type omits this state-hook runtime option.
    disabledBehavior,
  }
  render(
    <TagGroup
      {...runtimeProps}
      aria-label="Tags"
      disabledKeys={["a"]}
      selectionMode="multiple"
      onAction={(key) => trace.push(`group-action:${key}`)}
      onRemove={(keys) => trace.push(`remove:${[...keys].join()}`)}
      onSelectionChange={(keys) => trace.push(`selection:${[...keys].join()}`)}
    >
      <Tag
        id="a"
        textValue="Alpha"
        data-testid="a"
        onAction={() => trace.push("item-action")}
        onFocus={() => trace.push("item-focus")}
      >
        Alpha
      </Tag>
      <Tag id="b" textValue="Beta">
        Beta
      </Tag>
    </TagGroup>,
  )
  const row = screen.getByTestId("a")
  const removal = screen.getAllByTestId("tag-remove-button")[0]
  await userEvent.setup().click(row)
  expect({
    disabled: row.getAttribute("aria-disabled"),
    tabIndex: row.tabIndex,
    removalDisabled: removal.hasAttribute("disabled"),
    trace,
  }).toEqual({
    disabled: disabledBehavior === "all" ? "true" : null,
    tabIndex: -1,
    removalDisabled: true,
    trace: disabledBehavior === "all" ? [] : ["item-action", "group-action:a"],
  })
  expect(removal).toBeDisabled()
  expect(trace.some((value) => value.startsWith("selection:"))).toBe(false)
})

it("retains the source's actual root and item focus callback boundary", async () => {
  const trace: string[] = []
  const focusProps: ComponentProps<typeof TagGroup> = {
    // @ts-expect-error The pinned public wrapper does not expose root focus callbacks.
    onFocus: (event: FocusEvent<HTMLElement>) =>
      trace.push(`group-focus:${(event.target as HTMLElement).dataset.testid}`),
  }
  const blurProps: ComponentProps<typeof TagGroup> = {
    // @ts-expect-error The pinned public wrapper does not expose root blur callbacks.
    onBlur: (event: FocusEvent<HTMLElement>) =>
      trace.push(`group-blur:${(event.target as HTMLElement).dataset.testid}`),
  }
  render(
    <>
      <input aria-label="Before" />
      <TagGroup {...focusProps} {...blurProps} aria-label="Tags">
        <Tag
          id="a"
          textValue="Alpha"
          data-testid="a"
          onFocus={() => trace.push("item-focus:a")}
          onBlur={() => trace.push("item-blur:a")}
        >
          Alpha
        </Tag>
        <Tag id="b" textValue="Beta" data-testid="b">
          Beta
        </Tag>
      </TagGroup>
      <input aria-label="After" />
    </>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByTestId("a"))
  await user.click(screen.getByRole("textbox", { name: "After" }))
  expect(trace).toEqual(["item-focus:a", "item-blur:a"])
})

it("records actual Tab order", async () => {
  const observations: Record<string, string[]> = {}
  for (const removable of [false, true]) {
    const view = render(
      <>
        <input aria-label="Before" data-testid="before" />
        <TagGroup aria-label="Tags" onRemove={removable ? () => {} : undefined}>
          <Tag id="a" textValue="Alpha" data-testid="a">
            Alpha
          </Tag>
          <Tag id="b" textValue="Beta" data-testid="b">
            Beta
          </Tag>
        </TagGroup>
        <input aria-label="After" data-testid="after" />
      </>,
    )
    const user = userEvent.setup()
    const trace: string[] = []
    for (let index = 0; index < 7; index++) {
      await user.tab()
      const target = document.activeElement as HTMLElement
      trace.push(
        `${target.dataset.testid ?? target.tagName}:${(target.closest('[role="row"]') as HTMLElement | null)?.dataset.testid ?? ""}`,
      )
    }
    observations[String(removable)] = trace
    view.unmount()
  }
  expect(observations).toMatchInlineSnapshot(`
    {
      "false": [
        "before:",
        "a:a",
        "after:",
        "BODY:",
        "before:",
        "a:a",
        "after:",
      ],
      "true": [
        "before:",
        "a:a",
        "tag-remove-button:a",
        "tag-remove-button:b",
        "after:",
        "BODY:",
        "before:",
      ],
    }
  `)
})

it.each([false, true])("honors initial item autofocus with disabled=%s", async (disabled) => {
  render(
    <>
      <input aria-label="Before" />
      <TagGroup aria-label="Tags" disabledKeys={disabled ? ["a"] : []}>
        <Tag id="a" textValue="Alpha" data-testid="a" autoFocus>
          Alpha
        </Tag>
        <Tag id="b" textValue="Beta" data-testid="b">
          Beta
        </Tag>
      </TagGroup>
    </>,
  )
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId(disabled ? "b" : "a")))
})

it("retains the disabled autofocus item when the collection has no enabled item", async () => {
  render(
    <TagGroup aria-label="Tags" disabledKeys={["a", "b"]}>
      <Tag id="a" textValue="Alpha" data-testid="disabled-autofocus" autoFocus>
        Alpha
      </Tag>
      <Tag id="b" textValue="Beta">
        Beta
      </Tag>
    </TagGroup>,
  )
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("disabled-autofocus")))
})

it("passes live state and the actual item ref through custom rendering", async () => {
  const target = { current: null as HTMLDivElement | null }
  let selected = false
  const example = (keys: string[]) => (
    <TagGroup aria-label="Tags" selectionMode="multiple" selectedKeys={keys}>
      <Tag
        id="a"
        textValue="Alpha"
        ref={target}
        render={(props, state) => {
          selected = state.isSelected
          return <div {...props} data-testid="custom-tag" style={{ ...props.style, borderWidth: 7 }} />
        }}
      >
        Alpha
      </Tag>
    </TagGroup>
  )
  const view = render(example([]))
  const original = target.current
  expect(original).toBe(screen.getByTestId("custom-tag"))
  expect(selected).toBe(false)
  view.rerender(example(["a"]))
  expect(selected).toBe(true)
  expect(target.current).toBe(original)
  view.unmount()
  expect(target.current).toBeNull()
})
