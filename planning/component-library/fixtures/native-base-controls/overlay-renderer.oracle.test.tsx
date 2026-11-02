import { act, render, screen } from "@testing-library/react"
import { createRef, type HTMLAttributes } from "react"
import type { ModalRenderProps } from "react-aria-components"
import { expect, it, vi } from "vitest"

import AlertDialog from "../../../../packages/react/src/components/AlertDialog/AlertDialog"
import Modal from "../../../../packages/react/src/components/Modal/Modal"

it.each(["modal", "alert-dialog"] as const)(
  "%s renders the overlay separately from its original public panel ref and preserves owner veto and editor identity",
  async (kind) => {
    const panel = createRef<HTMLDivElement>()
    const editor = createRef<HTMLInputElement>()
    const requested = vi.fn()
    let values!: ModalRenderProps
    let originalProps!: HTMLAttributes<HTMLDivElement>
    const overlayRender = (props: HTMLAttributes<HTMLDivElement>, state: ModalRenderProps) => {
      originalProps = props
      values = state
      return <div {...props} data-overlay-renderer={kind} />
    }
    const content = <input ref={editor} aria-label="Retained draft" defaultValue="Original draft" />
    const node = (custom: boolean, open = true, padding = 7) => {
      const props = {
        ref: panel,
        "aria-label": "Task",
        isOpen: open,
        onOpenChange: requested,
        customOverlayStyles: { padding },
        render: custom ? overlayRender : undefined,
      }
      return kind === "modal" ? (
        <Modal {...props}>{content}</Modal>
      ) : (
        <AlertDialog {...props} titleText="Confirm" bodyText="Details">
          {content}
        </AlertDialog>
      )
    }
    const view = render(node(false))
    const originalPanel = await screen.findByTestId(kind)
    const originalOverlay = originalPanel.parentElement
    const originalEditor = editor.current
    expect(panel.current === originalPanel).toBe(true)
    expect(originalEditor).not.toBeNull()
    originalEditor!.value = "Held edited draft"
    originalEditor!.focus()
    view.rerender(node(true))
    const overlay = document.querySelector(`[data-overlay-renderer="${kind}"]`)!
    expect(overlay).not.toBeNull()
    expect(overlay === originalOverlay).toBe(true)
    expect(overlay === panel.current).toBe(false)
    expect(overlay.contains(originalPanel)).toBe(true)
    expect(panel.current === originalPanel).toBe(true)
    expect(editor.current === originalEditor).toBe(true)
    expect(originalEditor!.value).toBe("Held edited draft")
    expect(document.activeElement === originalEditor).toBe(true)
    expect(overlay).toHaveStyle({ padding: "7px" })
    expect(Object.keys(values).sort()).toEqual(["isEntering", "isExiting", "state"])
    expect(typeof values.isEntering).toBe("boolean")
    expect(typeof values.isExiting).toBe("boolean")
    expect(values.state.isOpen).toBe(true)
    for (const method of ["open", "close", "toggle", "setOpen"] as const)
      expect(typeof values.state[method]).toBe("function")
    expect(originalProps.children).toBeDefined()
    await act(() => values.state.close())
    expect(requested.mock.calls).toEqual([[false]])
    expect(values.state.isOpen).toBe(true)
    expect(panel.current === originalPanel).toBe(true)
    expect(editor.current === originalEditor).toBe(true)
    view.rerender(node(true, true, 0))
    expect(document.querySelector(`[data-overlay-renderer="${kind}"]`) === overlay).toBe(true)
    expect(overlay).toHaveStyle({ padding: "0px" })
    view.rerender(node(false))
    expect(originalPanel.parentElement === originalOverlay).toBe(true)
    expect(panel.current === originalPanel).toBe(true)
    expect(editor.current === originalEditor).toBe(true)
    expect(originalEditor!.value).toBe("Held edited draft")
    expect(document.activeElement === originalEditor).toBe(true)
    expect(requested.mock.calls).toEqual([[false]])
    view.rerender(node(true, false))
    expect(screen.queryByTestId(kind)).toBeNull()
    expect(panel.current).toBeNull()
    expect(editor.current).toBeNull()
    view.unmount()
  },
)
