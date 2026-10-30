import { act, fireEvent, render, screen } from "@testing-library/react"
import { createRef, useContext } from "react"
import {
  Button,
  DialogContext,
  DialogTrigger,
  Heading,
  OverlayTriggerStateContext,
  PopoverContext,
  RootMenuTriggerStateContext,
  type PopoverRenderProps,
} from "react-aria-components"
import { expect, it, vi } from "vitest"

import ClickPopover from "../../../../packages/react/src/components/ClickPopover/ClickPopover"

it("preserves the four-field renderer, context styles, original host refs and clearContexts", async () => {
  const triggerRef = createRef<HTMLButtonElement>()
  const rootRef = createRef<HTMLDivElement>()
  const contextRef = createRef<HTMLDivElement>()
  let state!: PopoverRenderProps
  const view = render(
    <DialogTrigger defaultOpen>
      <Button ref={triggerRef}>Trigger</Button>
      <PopoverContext.Provider
        value={{ ref: contextRef, triggerRef, style: () => ({ padding: 4, fontStyle: "italic" }) }}
      >
        <ClickPopover
          {...{ ref: rootRef }}
          customStyles={{ padding: 2 }}
          style={{ padding: 0 }}
          render={(props, values) => {
            state = values
            return <div {...props} />
          }}
        >
          <Heading slot="title">Title</Heading>
        </ClickPopover>
      </PopoverContext.Provider>
    </DialogTrigger>,
  )
  const root = await screen.findByTestId("click-popover")
  expect(rootRef.current).toBe(root)
  expect(contextRef.current).toBe(root)
  expect(root).toHaveStyle({ padding: "0px", fontStyle: "italic" })
  expect(Object.keys(state).sort()).toEqual(["isEntering", "isExiting", "placement", "trigger"])
  expect(state.trigger).toBeNull()
  view.unmount()
})

it("gives title naming priority over trigger fallback and supplies exact overlay close to descendants", async () => {
  const trace: string[] = []
  const onOpenChange = vi.fn(() => trace.push("owner-close"))
  let overlay!: NonNullable<React.ContextType<typeof OverlayTriggerStateContext>>
  let menu!: NonNullable<React.ContextType<typeof RootMenuTriggerStateContext>>
  let suppliedClose!: () => void
  const Probe = () => {
    overlay = useContext(OverlayTriggerStateContext)!
    menu = useContext(RootMenuTriggerStateContext)!
    return null
  }
  render(
    <DialogTrigger isOpen onOpenChange={onOpenChange}>
      <Button>Trigger</Button>
      <Probe />
      <DialogContext.Provider
        value={{
          children: ({ close }) => {
            suppliedClose = close
            return (
              <>
                <Heading slot="title">Title</Heading>
                <Button slot="close" onPress={() => trace.push("caller-press")}>
                  Close
                </Button>
              </>
            )
          },
        }}
      >
        <ClickPopover />
      </DialogContext.Provider>
    </DialogTrigger>,
  )
  const dialog = await screen.findByRole("dialog")
  expect(dialog).toHaveAccessibleName("Title")
  expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Title" }).id)
  expect(overlay).toBe(menu)
  expect(suppliedClose).toBe(overlay.close)
  await act(() => menu.openSubmenu("child", 0))
  expect(menu.expandedKeysStack).toEqual(["child"])
  await act(() => overlay.setOpen(false))
  expect(overlay.isOpen).toBe(true)
  expect(menu.expandedKeysStack).toEqual(["child"])
  await act(() => overlay.close())
  expect(menu.expandedKeysStack).toEqual([])
  expect(onOpenChange.mock.calls).toEqual([[false], [false]])
  trace.length = 0
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  expect(trace).toEqual(["owner-close", "caller-press"])
})
