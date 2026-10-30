import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, useContext } from "react"
import { BreadcrumbsContext } from "react-aria-components"
import { expect, it, vi } from "vitest"

import Breadcrumbs from "../../../../packages/react/src/components/Breadcrumbs/Breadcrumbs"

const items = ["A", "B", "C", "D", "E", "F"].map((content) => ({
  id: content,
  content,
  href: `#${content}`,
  disabled: false,
}))

it("retains the actual root ref, undefined renderer state and context-before-authored props and events", async () => {
  const ref = createRef<HTMLOListElement>()
  const states: unknown[] = []
  const events: unknown[] = []
  const onAction = vi.fn()
  const onClick = vi.fn((event) => event.preventDefault())
  const view = render(
    <BreadcrumbsContext.Provider
      value={{
        ref,
        id: "context-root",
        style: { padding: 4, letterSpacing: 7 },
        onAction,
        onPointerDown: (event) => events.push(event),
        render: (props, state) => {
          states.push(state)
          return <ol {...props} />
        },
      }}
    >
      <Breadcrumbs
        id="own-root"
        items={items.slice(0, 2)}
        customStyles={{ padding: 0, fontStyle: "italic" }}
        onPointerDown={(event) => events.push(event)}
        customBreadcrumbLinkProps={{ onClick }}
      />
    </BreadcrumbsContext.Provider>,
  )
  const root = screen.getByTestId("breadcrumbs")
  expect(ref.current).toBe(root)
  expect(root.id).toBe("own-root")
  expect(root).toHaveStyle({ padding: "0px", letterSpacing: "7px", fontStyle: "italic" })
  expect(states.length).toBeGreaterThan(0)
  expect(states.every((state) => state === undefined)).toBe(true)
  fireEvent.pointerDown(root)
  expect(events).toHaveLength(2)
  expect(events[0]).toBe(events[1])
  await userEvent.setup().click(screen.getByRole("link", { name: "A" }))
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(onAction).not.toHaveBeenCalled()
  view.unmount()
  expect(ref.current).toBeNull()
})

it("republishes named root props to portaled descendants while fixed children keep collection defaults inert", async () => {
  let inherited: React.ContextType<typeof BreadcrumbsContext>
  const ignoredChildren = vi.fn(() => null)
  const onAction = vi.fn()
  const Probe = () => {
    inherited = useContext(BreadcrumbsContext)
    return null
  }
  render(
    <BreadcrumbsContext.Provider
      value={{
        slots: {
          trail: {
            id: "inherited-root",
            isDisabled: true,
            onAction,
            items: [{ id: "unused", content: "Unused", href: "#unused", disabled: false }],
            dependencies: ["original"],
            children: ignoredChildren,
          },
        },
      }}
    >
      <Breadcrumbs
        slot="trail"
        items={items}
        maxVisibleItems={3}
        customClickPopoverProps={{
          isOpen: true,
          render: (props) => (
            <div {...props}>
              <Probe />
              {props.children}
            </div>
          ),
        }}
      />
    </BreadcrumbsContext.Provider>,
  )
  expect(screen.getByTestId("breadcrumbs").id).toBe("inherited-root")
  expect(inherited).toMatchObject({ id: "inherited-root", slot: "trail", isDisabled: true, onAction })
  expect(ignoredChildren).not.toHaveBeenCalled()
  expect(screen.queryByText("Unused")).toBeNull()
  expect(screen.getAllByTestId("link")[0]).toHaveAttribute("href", "#A")
  expect(screen.getAllByTestId("link")[0]).not.toHaveAttribute("data-disabled")
  expect(screen.getAllByTestId("breadcrumb")[0]).toHaveAttribute("data-disabled", "true")
  expect(onAction).not.toHaveBeenCalled()
})
