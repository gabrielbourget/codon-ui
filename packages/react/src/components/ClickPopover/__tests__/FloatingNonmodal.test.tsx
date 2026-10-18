import { render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Button, DialogTrigger, Heading, TooltipTrigger } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import HoverPopover from "../../HoverPopover/HoverPopover"
import Tooltip from "../../Tooltip/Tooltip"
import ClickPopover from "../ClickPopover"

describe("floating nonmodal interaction", () => {
  it.each([
    { label: "Tooltip", Component: Tooltip },
    { label: "HoverPopover", Component: HoverPopover },
  ])("keeps the parent action available with $label content mounted", async ({ Component, label }) => {
    const action = vi.fn()
    const user = userEvent.setup()
    render(
      <DialogTrigger defaultOpen>
        <Button>Parent trigger</Button>
        <ClickPopover>
          <Heading slot="title">Parent dialog</Heading>
          <TooltipTrigger delay={0} closeDelay={200000}>
            <Button onPress={action}>Parent action</Button>
            <Component>Action description</Component>
          </TooltipTrigger>
        </ClickPopover>
      </DialogTrigger>,
    )
    const parent = await screen.findByTestId("click-popover")
    const button = within(parent).getByRole("button", { name: "Parent action" })
    await user.tab()
    await user.hover(button)
    expect(await screen.findByTestId(label === "Tooltip" ? "tooltip" : "hover-popover")).toBeInTheDocument()
    await user.click(button)
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("click-popover")).toBe(parent)
  })

  it("delivers the background action when dismissing a nonmodal popover", async () => {
    const action = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <Button onPress={action}>Background action</Button>
        <DialogTrigger defaultOpen>
          <Button>Popover trigger</Button>
          <ClickPopover isNonModal>
            <Heading slot="title">Nonmodal content</Heading>
            Content
          </ClickPopover>
        </DialogTrigger>
      </>,
    )
    expect(await screen.findByTestId("click-popover")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Background action" }))
    expect(action).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId("click-popover")).not.toBeInTheDocument())
  })
})
