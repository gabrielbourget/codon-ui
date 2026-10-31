import { writeFileSync } from "node:fs"
import { useState } from "react"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import Toaster, { toast } from "../../../../packages/react/src/components/Toaster/Toaster"
import { ToasterObserver } from "../../../../packages/react/src/components/Toaster/stateManagement"

afterEach(() => {
  cleanup()
  ToasterObserver.subscribers = []
  ToasterObserver.toasts = []
})
it("keeps the other actual canonical Toaster observing the next document event after one root retires", async () => {
  let retire = () => {}
  const Owner = () => {
    const [first, setFirst] = useState(true)
    retire = () => setFirst(false)
    return (
      <>
        {first ? <Toaster data-testid="first-owner" duration="persistent" /> : null}
        <Toaster data-testid="second-owner" duration="persistent" />
      </>
    )
  }
  render(<Owner />)
  await act(() => {
    toast({ id: "live-oracle-a", duration: "persistent" })
    toast({ id: "live-oracle-b", duration: "persistent" })
  })
  await screen.findAllByRole("list")
  const list = () => within(screen.getByTestId("second-owner")).getByRole("list")
  const send = async (repeat = false) =>
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyE", key: "q", altKey: true, repeat, bubbles: true }),
      )
    })
  await send()
  expect(list()).toHaveAttribute("data-expanded", "true")
  await act(() => retire())
  await send(true)
  expect(list()).toHaveAttribute("data-expanded", "false")
  writeFileSync(
    "/private/tmp/codon-native-toaster-live-listener-oracle.json",
    JSON.stringify({
      actualCanonicalRoots: true,
      retiredFirst: true,
      secondExpandedThenCollapsed: true,
      nativeActions: 0,
    }) + "\n",
  )
})
