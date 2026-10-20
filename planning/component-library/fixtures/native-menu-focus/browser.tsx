import { createRoot } from "react-dom/client"
import { useState } from "react"
import { Button, I18nProvider, MenuTrigger, SubmenuTrigger } from "react-aria-components"

import MenuItem from "../../../../packages/react/src/components/Menu/components/MenuItem"
import Menu from "../../../../packages/react/src/components/Menu/Menu"

// This fixture records original browser delivery. It never dispatches an input event.
const journal: Record<string, unknown>[] = []
const events = new WeakMap<Event, number>()
let nextEvent = 0
const identify = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return null
  return target.getAttribute("data-proof") ?? target.getAttribute("aria-label") ?? target.id ?? target.tagName
}
const snapshot = () => ({
  focus: identify(document.activeElement),
  menus: [...document.querySelectorAll('[role="menu"]')].map((menu) => ({
    name: menu.getAttribute("aria-label"),
    labelledBy: menu.getAttribute("aria-labelledby"),
    pointerEvents: getComputedStyle(menu).pointerEvents,
    rect: menu.getBoundingClientRect().toJSON(),
  })),
})
const record = (entry: Record<string, unknown>) => {
  journal.push({ sequence: journal.length, time: performance.now(), ...entry })
  const output = document.getElementById("journal")
  if (output) output.textContent = JSON.stringify(journal, null, 2)
}
const input = (event: Event, phase: string) => {
  if (!events.has(event)) events.set(event, ++nextEvent)
  const pointer = event instanceof PointerEvent ? event : undefined
  record({
    kind: "input",
    event: events.get(event),
    type: event.type,
    phase,
    trusted: event.isTrusted,
    target: identify(event.target),
    path: event.composedPath().map(identify).filter(Boolean),
    defaultPrevented: event.defaultPrevented,
    pointerType: pointer?.pointerType,
    buttons: pointer?.buttons,
    x: pointer?.clientX,
    y: pointer?.clientY,
    key: event instanceof KeyboardEvent ? event.key : undefined,
    hit: pointer ? identify(document.elementFromPoint(pointer.clientX, pointer.clientY)) : undefined,
    ...snapshot(),
  })
}
for (const type of [
  "pointermove",
  "pointerover",
  "pointerout",
  "pointerdown",
  "pointerup",
  "click",
  "focusin",
  "focusout",
  "keydown",
  "keyup",
]) {
  window.addEventListener(
    type,
    (event) => {
      input(event, "capture")
      setTimeout(() => input(event, "after-turn"), 0)
    },
    true,
  )
  window.addEventListener(type, (event) => input(event, "bubble"))
}
new MutationObserver((records) => {
  if (records.some((record) => record.target instanceof Element && record.target.matches('[role="menu"]')))
    record({ kind: "menu-mutation", ...snapshot() })
}).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["style"] })

const callbacks = (name: string) => ({
  "data-proof": name,
  onHoverStart: () => record({ kind: "callback", name, callback: "hover-start", ...snapshot() }),
  onHoverEnd: () => record({ kind: "callback", name, callback: "hover-end", ...snapshot() }),
  onPressStart: (event: { pointerType: string }) =>
    record({ kind: "callback", name, callback: "press-start", pointerType: event.pointerType, ...snapshot() }),
  onPressEnd: (event: { pointerType: string }) =>
    record({ kind: "callback", name, callback: "press-end", pointerType: event.pointerType, ...snapshot() }),
  onAction: () => record({ kind: "callback", name, callback: "action", ...snapshot() }),
})

const Example = () => {
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr")
  const [underlyingHit, setUnderlyingHit] = useState(false)
  return (
    <I18nProvider locale={direction === "ltr" ? "en-US" : "ar-AE"}>
      <h1>Canonical Menu pointer proof</h1>
      <button onClick={() => setDirection(direction === "ltr" ? "rtl" : "ltr")}>Direction: {direction}</button>
      <button onClick={() => setUnderlyingHit(!underlyingHit)}>
        Underlying hit scenario: {underlyingHit ? "on" : "off"}
      </button>
      <button onClick={() => record({ kind: "checkpoint", ...snapshot() })}>Checkpoint</button>
      <button
        onClick={async () => {
          record({ kind: "save", ...snapshot() })
          const response = await fetch("/receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAgent: navigator.userAgent, journal }),
          })
          record({ kind: "saved", receipt: await response.text() })
        }}
      >
        Save browser receipt
      </button>
      <div dir={direction} style={{ position: "relative", width: 800, height: 360, padding: 80 }}>
        <button
          data-proof="underlying"
          style={{ position: "absolute", inset: 60 }}
          onClick={() => record({ kind: "underlying-action", ...snapshot() })}
        >
          Underlying control
        </button>
        <MenuTrigger key={`${direction}-${underlyingHit}`}>
          <Button data-proof="root-trigger" style={{ position: "relative", marginInlineStart: 200 }}>
            Open actions
          </Button>
          <Menu
            isNonModal={underlyingHit}
            menuAriaLabel="Root actions"
            placement="bottom start"
            shouldCloseOnSelect={false}
            customStyles={{
              background: "white",
              border: "1px solid",
              padding: 8,
              width: 220,
              pointerEvents: underlyingHit ? "none" : undefined,
            }}
          >
            <MenuItem id="before" {...callbacks("before")}>
              Before
            </MenuItem>
            <SubmenuTrigger delay={200}>
              <MenuItem id="branch" {...callbacks("branch")}>
                More actions
              </MenuItem>
              <Menu
                menuAriaLabel="Child actions"
                placement={direction === "ltr" ? "right top" : "left top"}
                shouldCloseOnSelect={false}
                customStyles={{ background: "white", border: "1px solid", padding: 8, width: 220 }}
              >
                <MenuItem id="child" {...callbacks("child")}>
                  Child action
                </MenuItem>
                <SubmenuTrigger delay={200}>
                  <MenuItem id="nested" {...callbacks("nested")}>
                    Nested actions
                  </MenuItem>
                  <Menu
                    menuAriaLabel="Nested actions"
                    placement={direction === "ltr" ? "right top" : "left top"}
                    shouldCloseOnSelect={false}
                    customStyles={{ background: "white", border: "1px solid", padding: 8, width: 180 }}
                  >
                    <MenuItem id="leaf" {...callbacks("leaf")}>
                      Leaf action
                    </MenuItem>
                  </Menu>
                </SubmenuTrigger>
              </Menu>
            </SubmenuTrigger>
            <MenuItem id="sibling" {...callbacks("sibling")}>
              Sibling
            </MenuItem>
            <MenuItem id="after" {...callbacks("after")}>
              After
            </MenuItem>
          </Menu>
        </MenuTrigger>
      </div>
      <details>
        <summary>Original event journal</summary>
        <pre id="journal" />
      </details>
    </I18nProvider>
  )
}

createRoot(document.getElementById("root")!).render(<Example />)
